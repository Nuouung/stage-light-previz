import { z } from "zod";
import { LightColor } from "./common";

/**
 * 조명은 실제 조명기가 아니라 "구역 × 방향"으로 적는다. 배우에게 조명 계획을 보여 주는 자료라서
 * 실제 행잉·채널은 다루지 않는다. 정밀한 설계는 Capture가 맡는다.
 * 구역: 연기 공간을 앞뒤 2줄 × 좌우 3칸으로 나눈 것. left는 객석에서 볼 때 왼쪽(하수), down은 객석 쪽.
 */
export const ZONES = ["down-left", "down-center", "down-right", "up-left", "up-center", "up-right"] as const;
export const Zone = z.enum(ZONES);
export type Zone = z.infer<typeof Zone>;

/** front는 객석 쪽에서 얼굴을, top은 위에서 공간을, back은 뒤에서 윤곽을 만든다. */
export const DIRECTIONS = ["front", "top", "back"] as const;
export const Direction = z.enum(DIRECTIONS);
export type Direction = z.infer<typeof Direction>;

/** 큐에서 빛 하나의 값. 적지 않은 항목은 이전 큐 값을 따른다(트래킹). 없는 항목을 적으면 데이터 검사에서 걸린다. */
export const CueLight = z.strictObject({
  zone: Zone,
  direction: Direction,
  /** 밝기 0~100 */
  intensity: z.number().min(0).max(100).optional(),
  color: LightColor.optional(),
  /** 바닥 빛 폭의 배율. 1이 기본, 작을수록 좁다 */
  spread: z.number().positive().max(1).optional(),
  /** 구역 가운데 대신 겨눌 바닥 지점. 사람 한 명을 따로 비출 때 쓴다. null이면 구역 가운데로 돌아간다 */
  at: z.object({ x: z.number(), z: z.number() }).nullable().optional(),
});
export type CueLight = z.infer<typeof CueLight>;

/** 빛 하나를 가리키는 이름표. */
export const lightKey = (zone: Zone, direction: Direction) => `${zone}/${direction}`;
