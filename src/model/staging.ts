import { z } from "zod";
import { Id, Vec3 } from "./common";
import { CueLight } from "./light";

/**
 * 배치(Staging): "이 작품을 이 공연장에서" 할 때만 의미 있는 것.
 * 현장 셋업 노트에 해당한다. 공연장이 바뀌면 Staging만 새로 만든다.
 */

/** 세트 물체를 어디에 놓을지. 좌표는 이 공연장 기준. */
export const Placement = z.object({
  objectId: Id,
  /** 바닥 중심 위치 */
  position: Vec3,
  /** 위에서 볼 때 y축 회전(도). 0 = 긴 변이 객석과 나란함 */
  rotation: z.number().default(0),
  /** 넘어뜨려 놓은 상태(엎어진 의자 등) */
  tipped: z.boolean().default(false),
});
export type Placement = z.infer<typeof Placement>;

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

/** 큐에서 세트 물체를 옮긴 것. 적지 않은 항목은 이전 값을 따른다(트래킹). */
export const ObjectMove = z.object({
  objectId: Id,
  position: Vec3.optional(),
  rotation: z.number().optional(),
  tipped: z.boolean().optional(),
});
export type ObjectMove = z.infer<typeof ObjectMove>;

/** 작품의 큐 하나에 대해, 이 공연장에서 바뀌는 조명값·인물 위치·물체 위치. 바뀐 것만 적는다. */
export const CueValues = z.object({
  cueId: Id,
  lights: z.array(CueLight).default([]),
  blocking: z.array(Blocking).default([]),
  objects: z.array(ObjectMove).default([]),
});
export type CueValues = z.infer<typeof CueValues>;

export const Staging = z.object({
  id: Id,
  projectId: Id,
  stageId: Id,
  /** 이 배치에서만 바꾸는 막 상태. 예: { "draw-2": true } = 2번 막 닫음 */
  curtainOverrides: z.record(z.string(), z.boolean()).default({}),
  /** 이 배치에서 쓰지 않는 막. 화면과 조작부에 나오지 않는다 */
  hiddenCurtains: z.array(Id).default([]),
  /** 연기 공간(조명으로 비추는 영역). 무대 중앙 기준 폭, 무대 앞끝부터의 깊이(m). 조명 구역이 이걸 나눠서 정해진다 */
  actingArea: z.object({ width: z.number().positive(), depth: z.number().positive() }),
  /** 빛을 연기 공간 안쪽으로 모아서 보여 준다 */
  cutLightsToActingArea: z.boolean().default(false),
  /** 놓지 않은 물체는 무대에 나오지 않는다 */
  placements: z.array(Placement),
  /** 큐마다 바뀌는 값. 아무것도 안 바뀌는 큐는 빠져도 된다 */
  cues: z.array(CueValues).default([]),
  /** 아직 현장에서 확인 안 된 값에 대한 메모 */
  notes: z.array(z.string()).default([]),
  dataVersion: z.string(),
});
export type Staging = z.infer<typeof Staging>;
