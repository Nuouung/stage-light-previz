import { ShaderChunk } from "three";

/** 조명을 자르는 바닥 위 직사각형(m, three.js 좌표). */
export type CutRect = { xMin: number; xMax: number; zMin: number; zMax: number };

/** 칼로 자른 듯 딱 떨어지면 어색해서 가장자리를 살짝 부드럽게 한다(m) */
const FEATHER = 0.08;

/**
 * 조명 하나가 비추는 범위를 바닥의 직사각형까지로 자르는 계산.
 * 조명에서 어떤 점을 지나 바닥까지 선을 그어, 닿는 곳이 직사각형 안이면 1, 밖이면 0.
 * 즉 조명기에서 직사각형으로 내려오는 사각뿔 안쪽만 빛을 받는다(프레이밍 셔터로 잘랐을 때의 모양).
 */
export const CUT_GLSL = /* glsl */ `
  float lightCutCoverage(vec3 lightPos, vec3 point, vec4 rect) {
    float t = lightPos.y / max(lightPos.y - point.y, 0.001);
    vec2 hit = lightPos.xz + (point.xz - lightPos.xz) * t;
    float f = ${FEATHER.toFixed(3)};
    return smoothstep(rect.x - f, rect.x + f, hit.x) * (1.0 - smoothstep(rect.y - f, rect.y + f, hit.x))
      * smoothstep(rect.z - f, rect.z + f, hit.y) * (1.0 - smoothstep(rect.w - f, rect.w + f, hit.y));
  }
`;

const ANCHOR_FUNCTION = "void getSpotLightInfo(";
const ANCHOR_COLOR = "light.color = spotLight.color * spotAttenuation;";

const glslVec4 = (r: CutRect) => `vec4(${[r.xMin, r.xMax, r.zMin, r.zMax].map((n) => n.toFixed(4)).join(", ")})`;

/**
 * three.js의 스포트라이트 계산에 자르기를 끼워 넣은 코드를 돌려준다. 원본 코드가 달라지면 에러를 낸다.
 * three.js는 조명을 카메라 기준 좌표로 계산하므로 세계 좌표로 되돌려서 잰다.
 */
export function patchSpotLightChunk(source: string, rect: CutRect): string {
  if (!source.includes(ANCHOR_FUNCTION) || !source.includes(ANCHOR_COLOR)) {
    throw new Error("three.js 스포트라이트 코드가 달라져 조명 자르기를 넣을 수 없음");
  }
  const helper = /* glsl */ `
    ${CUT_GLSL}
    vec3 viewToWorld(vec3 p) {
      return transpose(mat3(viewMatrix)) * (p - viewMatrix[3].xyz);
    }
  `;
  return source
    .replace(ANCHOR_FUNCTION, `${helper}\n${ANCHOR_FUNCTION}`)
    .replace(
      ANCHOR_COLOR,
      `light.color = spotLight.color * spotAttenuation * lightCutCoverage(viewToWorld(spotLight.position), viewToWorld(geometryPosition), ${glslVec4(rect)});`,
    );
}

let installed = false;

/** 첫 화면을 그리기 전에 한 번만 부른다. 셰이더를 만들 때 이 코드가 들어간다. */
export function installLightCut(rect: CutRect): void {
  if (installed) return;
  installed = true;
  ShaderChunk.lights_pars_begin = patchSpotLightChunk(ShaderChunk.lights_pars_begin, rect);
}
