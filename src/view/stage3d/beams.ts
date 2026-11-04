import * as THREE from "three";
import { CUT_GLSL, type CutRect } from "./lightCut";

/**
 * 빛줄기(헤이즈 속 빔) 모양 만들기. 렌더러 전용.
 * 조명기에서 겨눈 곳까지 위가 잘린 반투명 원뿔을 그린다. 끝으로 갈수록, 가장자리로 갈수록 옅어진다.
 * 뾰족한 고깔처럼 보이지 않게, 렌즈 폭만큼의 작은 원에서 시작한다.
 * 폭은 바닥의 빛보다 좁게 그린다. 정확함보다 보기 좋은 모양을 우선한 값이다.
 * 빛을 더하는 방식(additive)이라 겹치는 곳은 더 밝아진다.
 */

/** 바닥 빛 폭에 대한 빛줄기 폭의 비율 */
const BEAM_WIDTH = 0.55;
/** 빛줄기 끝 반지름에 대한 시작 반지름의 비율 */
const LENS_RATIO = 0.14;

const vertex = /* glsl */ `
  uniform float uHeight;
  varying float vAlong;      // 0 = 조명기, 1 = 끝
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vAlong = 0.5 - position.y / uHeight;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform vec3 uLightPos;
  uniform vec4 uCut;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  ${CUT_GLSL}
  void main() {
    // 원뿔 가운데(시선과 면이 마주 보는 곳)가 진하고 가장자리가 옅다
    float edge = pow(abs(dot(vNormal, vView)), 3.0);
    // 조명기 쪽이 진하고 멀어질수록 옅어진다
    float fall = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.4);
    // 시작 부분이 칼로 자른 듯 보이지 않게 살짝 번지며 나타난다
    fall *= smoothstep(0.0, 0.08, vAlong);
    float a = uStrength * edge * fall * lightCutCoverage(uLightPos, vWorld, uCut);
    // 더하기 방식(source × alpha + 배경)이라 색은 그대로, 진하기는 alpha로만 준다
    gl_FragColor = vec4(uColor, a);
  }
`;

/** 빛줄기 하나. 위치·방향·크기는 update로 바꾼다. */
export function createBeam(cut: CutRect | null): THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial> {
  // 자르지 않을 때는 아주 넓은 직사각형으로 둔다. 넓어서 경계 번짐이 닿지 않는다
  const rect = cut ? new THREE.Vector4(cut.xMin, cut.xMax, cut.zMin, cut.zMax) : new THREE.Vector4(-1e4, 1e4, -1e4, 1e4);
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uStrength: { value: 0 }, uHeight: { value: 1 }, uLightPos: { value: new THREE.Vector3() }, uCut: { value: rect } },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.CylinderGeometry(LENS_RATIO, 1, 1, 32, 1, true), material);
}

const UP = new THREE.Vector3(0, 1, 0);

/** from(조명기)에서 to(겨눈 곳)로 향하는 빔 각도 angleDeg인 빛에 맞춰 빛줄기를 놓는다. */
export function updateBeam(
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>,
  from: THREE.Vector3,
  to: THREE.Vector3,
  angleDeg: number,
  color: string,
  strength: number,
) {
  const dir = new THREE.Vector3().subVectors(from, to);
  const length = dir.length();
  const radius = Math.tan(((angleDeg / 2) * Math.PI) / 180) * length * BEAM_WIDTH;
  // 좁은 쪽이 +y. 크기 1짜리를 늘려서 쓴다
  mesh.scale.set(radius, length, radius);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  const u = mesh.material.uniforms;
  u.uColor!.value.set(color);
  u.uStrength!.value = strength;
  u.uHeight!.value = 1;
  u.uLightPos!.value.copy(from);
}
