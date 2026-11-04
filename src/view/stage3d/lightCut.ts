import { ShaderChunk } from "three";

/** 조명을 자르는 바닥 위 직사각형(m, three.js 좌표). */
export type CutRect = { xMin: number; xMax: number; zMin: number; zMax: number };

/** 경계 번짐: 조명에서 경계까지 거리에 곱한다. 가까이 있는 조명일수록 경계가 또렷하다 */
const FEATHER_SOFT = 0.09;
const FEATHER_HARD = 0.012;
/** 반도어 틈 등으로 경계 밖에 새는 빛의 비율 */
const SPILL_SOFT = 0.07;
const SPILL_HARD = 0.015;

/**
 * 조명 하나가 비추는 범위를 바닥의 직사각형 쪽으로 줄이는 계산.
 * 조명에서 어떤 점을 지나 바닥까지 선을 그어, 닿는 곳이 직사각형 안이면 1, 밖이면 새는 빛만 남는다.
 * soft 1은 프레넬(반도어로 대강 가림: 경계가 넓게 흐리고 빛이 샌다), 0은 프로파일(셔터: 경계가 또렷하다).
 * 번짐과 새는 빛의 양은 측정값이 아니라 눈으로 맞춘 값이다.
 */
export const CUT_GLSL = /* glsl */ `
  float lightCutCoverage(vec3 lightPos, vec3 point, vec4 rect, float soft) {
    float t = lightPos.y / max(lightPos.y - point.y, 0.001);
    vec2 hit = lightPos.xz + (point.xz - lightPos.xz) * t;
    float f = mix(${FEATHER_HARD.toFixed(3)}, ${FEATHER_SOFT.toFixed(3)}, soft) * length(vec3(hit.x, 0.0, hit.y) - lightPos);
    float inside = smoothstep(rect.x - f, rect.x + f, hit.x) * (1.0 - smoothstep(rect.y - f, rect.y + f, hit.x))
      * smoothstep(rect.z - f, rect.z + f, hit.y) * (1.0 - smoothstep(rect.w - f, rect.w + f, hit.y));
    return mix(mix(${SPILL_HARD.toFixed(3)}, ${SPILL_SOFT.toFixed(3)}, soft), 1.0, inside);
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
    // 렌더러가 프레넬은 penumbra 0.7, 프로파일은 0.15로 준다. 그 값을 되읽어 부드러운 정도로 쓴다
    float spotSoftness(const in SpotLight spot) {
      return smoothstep(0.2, 0.6, 1.0 - acos(spot.penumbraCos) / acos(spot.coneCos));
    }
  `;
  return source
    .replace(ANCHOR_FUNCTION, `${helper}\n${ANCHOR_FUNCTION}`)
    .replace(
      ANCHOR_COLOR,
      `light.color = spotLight.color * spotAttenuation * lightCutCoverage(viewToWorld(spotLight.position), viewToWorld(geometryPosition), ${glslVec4(rect)}, spotSoftness(spotLight));`,
    );
}

let installed = false;

/** 첫 화면을 그리기 전에 한 번만 부른다. 셰이더를 만들 때 이 코드가 들어간다. */
export function installLightCut(rect: CutRect): void {
  if (installed) return;
  installed = true;
  ShaderChunk.lights_pars_begin = patchSpotLightChunk(ShaderChunk.lights_pars_begin, rect);
}
