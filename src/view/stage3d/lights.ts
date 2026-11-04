import { DIRECTIONS, lightKey, ZONES, type Direction, type LightColor, type Zone } from "../../model";
import type { LightLook } from "../../player";
import type { ComposedStage } from "../../stage/compose";
import { floorHeightAt } from "./shapes";

/**
 * 렌더러에 넘기는 빛 목록. 구역과 방향으로 적은 값을 3차원 위치로 바꾼다.
 * 실제 조명기 위치가 아니라, 조명 계획이 눈에 잘 보이도록 잡은 가상의 위치다.
 */
export type LightBeam = {
  id: string;
  /** 빛이 나오는 곳 (데이터 좌표) */
  position: { x: number; y: number; z: number };
  /** 겨누는 지점 */
  target: { x: number; y: number; z: number };
  /** 빔 각도(도) */
  beamAngle: number;
  /** #rrggbb */
  color: string;
  /** 0~1. 0이면 꺼진 빛 */
  level: number;
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

/** 빛이 나오는 높이(m)와, 프런트가 나오는 객석 쪽 깊이(m). 눈으로 맞춘 값이다 */
const SOURCE = { frontZ: -4.6, frontY: 6.8, topY: 6.5, backY: 6.5, backOffset: 3 };
/** 바닥에 떨어지는 빛 원의 반지름(m). 켜진 구역 사이에 어두운 틈이 안 보이게 잡았다 */
const POOL_RADIUS: Record<Direction, number> = { front: 2.2, top: 2.1, back: 2.3 };

/** 구역의 가운데. 좌우 3칸, 앞뒤 2줄 */
export function zoneCenter(zone: Zone, area: { width: number; depth: number }): { x: number; z: number } {
  const [row, column] = zone.split("-") as ["down" | "up", "left" | "center" | "right"];
  return {
    x: { left: -area.width / 3, center: 0, right: area.width / 3 }[column],
    z: area.depth * (row === "down" ? 0.28 : 0.8),
  };
}

const sourceOf = (direction: Direction, x: number, z: number) =>
  ({
    front: { x, y: SOURCE.frontY, z: SOURCE.frontZ },
    top: { x, y: SOURCE.topY, z: z - 0.2 },
    back: { x, y: SOURCE.backY, z: z + SOURCE.backOffset },
  })[direction];

/** 사람을 겨눈 프런트 빛의 높이(m). 바닥을 겨누면 빛이 좁을 때 얼굴이 빛 밖으로 벗어난다 */
const PERSON_AIM_HEIGHT = 1.2;

/**
 * 구역 × 방향의 빛 전부를 돌려준다. 꺼진 빛도 밝기 0으로 포함한다.
 * 빛의 개수가 큐마다 달라지면 화면이 조명 계산을 다시 준비해서 끊길 수 있어서 항상 같은 개수로 둔다.
 */
export function describeLights(composed: ComposedStage, area: { width: number; depth: number }, looks: Record<string, LightLook>): LightBeam[] {
  const beams: LightBeam[] = [];
  for (const zone of ZONES) {
    const center = zoneCenter(zone, area);
    for (const direction of DIRECTIONS) {
      const key = lightKey(zone, direction);
      const look = looks[key];
      const { x, z } = look?.at ?? center;
      const lift = look?.at && direction === "front" ? PERSON_AIM_HEIGHT : 0;
      const target = { x, y: floorHeightAt(composed, x, z) + lift, z };
      const position = sourceOf(direction, x, z);
      const distance = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
      beams.push({
        id: key,
        position,
        target,
        beamAngle: (2 * Math.atan((POOL_RADIUS[direction] * (look?.spread ?? 1)) / distance) * 180) / Math.PI,
        color: colorToHex(look?.color),
        level: (look?.intensity ?? 0) / 100,
      });
    }
  }
  return beams;
}
