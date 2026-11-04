import type { LightColor } from "../model";
import type { LightLook, Look } from "./resolve";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpColor(a: LightColor | undefined, b: LightColor | undefined, t: number): LightColor | undefined {
  if (!a || !b) return t < 1 ? (a ?? b) : b;
  if ("cct" in a && "cct" in b) return { cct: lerp(a.cct, b.cct, t) };
  if ("r" in a && "r" in b) {
    return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t), w: lerp(a.w ?? 0, b.w ?? 0, t) };
  }
  // 색 방식이 다르면(색온도 ↔ RGB) 섞지 않고 끝에서 바꾼다
  return t < 1 ? a : b;
}

function lerpLight(a: LightLook | undefined, b: LightLook | undefined, t: number): LightLook {
  const from = a ?? { intensity: 0 };
  const to = b ?? { intensity: 0 };
  return {
    ...to,
    intensity: lerp(from.intensity ?? 0, to.intensity ?? 0, t),
    color: lerpColor(from.color, to.color, t),
  };
}

/**
 * 페이드 중간 상태. t = 0이면 from, t = 1이면 to.
 * 조명 밝기·색은 서서히 바뀌고, 인물과 물체 위치는 t = 1에서 한 번에 바뀐다.
 */
export function interpolate(from: Look, to: Look, t: number): Look {
  const k = Math.min(1, Math.max(0, t));
  const ids = new Set([...Object.keys(from.lights), ...Object.keys(to.lights)]);
  const lights: Look["lights"] = {};
  for (const id of ids) lights[id] = lerpLight(from.lights[id], to.lights[id], k);
  return { lights, characters: k < 1 ? from.characters : to.characters, objects: k < 1 ? from.objects : to.objects };
}
