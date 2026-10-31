import type { FixtureType, LightColor, Stage } from "../../model";
import type { LightLook } from "../../player";

/**
 * 렌더러에 넘기는 "켤 조명" 목록과, 배튼에 매달린 조명기 몸체 목록.
 * 무엇을 어떻게 비출지만 정하고, 실제로 빛을 만드는 건 렌더러가 한다.
 */
export type LightBeam = {
  id: string;
  /** 조명기 위치 (데이터 좌표) */
  position: { x: number; y: number; z: number };
  /** 겨누는 지점 */
  target: { x: number; y: number; z: number };
  /** 빔 각도(도) */
  beamAngle: number;
  /** #rrggbb */
  color: string;
  /** 0~1. 밝기 × 기종 출력 */
  level: number;
  /** 프레넬처럼 가장자리가 퍼지는지 */
  soft: boolean;
};

/** 색온도(K)를 화면용 RGB로. 무대에서 흔히 쓰는 2700~6500K 구간을 표에서 보간한다. */
const CCT_TABLE: [number, [number, number, number]][] = [
  [2700, [255, 169, 87]],
  [3200, [255, 190, 126]],
  [4000, [255, 209, 163]],
  [5600, [255, 238, 227]],
  [6500, [255, 249, 253]],
];

export function cctToRgb(k: number): [number, number, number] {
  const first = CCT_TABLE[0]!;
  const last = CCT_TABLE[CCT_TABLE.length - 1]!;
  if (k <= first[0]) return first[1];
  if (k >= last[0]) return last[1];
  for (let i = 1; i < CCT_TABLE.length; i++) {
    const [k1, c1] = CCT_TABLE[i]!;
    const [k0, c0] = CCT_TABLE[i - 1]!;
    if (k <= k1) {
      const t = (k - k0) / (k1 - k0);
      return [0, 1, 2].map((j) => Math.round(c0[j]! + (c1[j]! - c0[j]!) * t)) as [number, number, number];
    }
  }
  return last[1];
}

const hex = (rgb: [number, number, number]) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

export function colorToHex(c: LightColor | undefined): string {
  if (!c) return "#ffffff";
  if ("cct" in c) return hex(cctToRgb(c.cct));
  // RGBW: 흰색 채널은 세 색에 고르게 더한다
  const w = c.w ?? 0;
  return hex([Math.min(255, c.r + w), Math.min(255, c.g + w), Math.min(255, c.b + w)]);
}

/** 큐 시점의 조명값을 켤 조명 목록으로. 밝기 0이거나 값이 없는 조명은 빼고 돌려준다. */
export function describeLights(stage: Stage, types: FixtureType[], looks: Record<string, LightLook>): LightBeam[] {
  const beams: LightBeam[] = [];
  for (const f of stage.fixtures) {
    const look = looks[f.id];
    const intensity = look?.intensity ?? 0;
    if (intensity <= 0) continue;
    const type = types.find((t) => t.id === f.typeId);
    const pos = stage.positions.find((p) => p.id === f.positionId);
    if (!type || !pos) continue;
    beams.push({
      id: f.id,
      position: { x: f.x, y: pos.y - 0.3, z: pos.z },
      target: f.aim,
      beamAngle: look?.beamAngle ?? f.beamAngle,
      color: colorToHex(look?.color),
      level: (intensity / 100) * type.relativeOutput,
      soft: type.optics === "soft",
    });
  }
  return beams;
}
