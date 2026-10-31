import { z } from "zod";
import { Id, LightColor, Vec3 } from "./common";

/**
 * 배치(Staging): "이 작품을 이 공연장에서" 할 때만 의미 있는 것.
 * 현장 셋업 노트에 해당한다. 공연장이 바뀌면 Staging만 새로 만든다.
 */

/** 세트 물체를 어디에 놓을지. 좌표는 이 공연장 기준. */
export const Placement = z.object({
  objectId: Id,
  /** 바닥 중심 위치 */
  position: Vec3,
  /** y축 회전(도) */
  rotation: z.number().default(0),
});
export type Placement = z.infer<typeof Placement>;

/** 큐에서 조명 한 대의 값. 적지 않은 항목은 이전 큐 값을 따른다(트래킹). */
export const CueState = z.object({
  fixtureId: Id,
  /** 밝기 0~100 */
  intensity: z.number().min(0).max(100).optional(),
  color: LightColor.optional(),
  beamAngle: z.number().positive().optional(),
  pan: z.number().optional(),
  tilt: z.number().optional(),
});
export type CueState = z.infer<typeof CueState>;

/** 큐에서 인물 한 명의 위치·자세. 적지 않은 항목은 이전 큐 값을 따른다(트래킹). */
export const Blocking = z.object({
  characterId: Id,
  /** 바닥 위치 (x, z). 단상 위면 높이는 물체에서 계산 */
  x: z.number().optional(),
  z: z.number().optional(),
  /** 바라보는 방향(도). 0 = 객석 정면 */
  facing: z.number().optional(),
  posture: z.enum(["stand", "sit"]).optional(),
  onStage: z.boolean().optional(),
});
export type Blocking = z.infer<typeof Blocking>;

/** 작품의 큐 하나에 대해, 이 공연장에서 바뀌는 조명값·인물 위치. 바뀐 것만 적는다. */
export const CueValues = z.object({
  cueId: Id,
  lights: z.array(CueState).default([]),
  blocking: z.array(Blocking).default([]),
});
export type CueValues = z.infer<typeof CueValues>;

export const Staging = z.object({
  id: Id,
  projectId: Id,
  stageId: Id,
  /** 이 배치에서만 바꾸는 막 상태. 예: { "draw-2": true } = 2번 막 닫음 */
  curtainOverrides: z.record(z.string(), z.boolean()).default({}),
  /** 놓지 않은 물체는 무대에 나오지 않는다 */
  placements: z.array(Placement),
  /** 큐마다 바뀌는 값. 아무것도 안 바뀌는 큐는 빠져도 된다 */
  cues: z.array(CueValues).default([]),
  dataVersion: z.string(),
});
export type Staging = z.infer<typeof Staging>;
