import * as THREE from "three";

/**
 * 빛줄기(헤이즈 속 빔) 모양 만들기. 렌더러 전용.
 * 조명기에서 겨눈 곳까지 반투명 원뿔을 그린다. 끝으로 갈수록, 가장자리로 갈수록 옅어진다.
 * 빛을 더하는 방식(additive)이라 겹치는 곳은 더 밝아진다.
 */

const vertex = /* glsl */ `
  uniform float uHeight;
  varying float vAlong;      // 0 = 조명기, 1 = 끝
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vAlong = 0.5 - position.y / uHeight;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uSoft;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // 원뿔 가운데(시선과 면이 마주 보는 곳)가 진하고 가장자리가 옅다
    float edge = pow(abs(dot(vNormal, vView)), mix(0.8, 2.0, uSoft));
    // 조명기 쪽이 진하고 멀어질수록 옅어진다
    float fall = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.4);
    float a = uStrength * edge * fall;
    // 더하기 방식(source × alpha + 배경)이라 색은 그대로, 진하기는 alpha로만 준다
    gl_FragColor = vec4(uColor, a);
  }
`;

/** 빛줄기 하나. 위치·방향·크기는 update로 바꾼다. */
export function createBeam(): THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uStrength: { value: 0 }, uSoft: { value: 1 }, uHeight: { value: 1 } },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32, 1, true), material);
}

const UP = new THREE.Vector3(0, 1, 0);

/** from(조명기)에서 to(겨눈 곳)로 향하는 빔 각도 angleDeg짜리 원뿔로 맞춘다. */
export function updateBeam(
  mesh: THREE.Mesh<THREE.ConeGeometry, THREE.ShaderMaterial>,
  from: THREE.Vector3,
  to: THREE.Vector3,
  angleDeg: number,
  color: string,
  strength: number,
  soft: boolean,
) {
  const dir = new THREE.Vector3().subVectors(from, to);
  const length = dir.length();
  const radius = Math.tan(((angleDeg / 2) * Math.PI) / 180) * length;
  // ConeGeometry는 꼭짓점이 +y. 크기 1짜리를 늘려서 쓴다
  mesh.scale.set(radius, length, radius);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  const u = mesh.material.uniforms;
  u.uColor!.value.set(color);
  u.uStrength!.value = strength;
  u.uSoft!.value = soft ? 1 : 0;
  u.uHeight!.value = 1;
}
