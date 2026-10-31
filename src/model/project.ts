import { z } from "zod";
import { Id, LightColor, Vec3 } from "./common";

/** 공연에만 들어가는 무대 물체 (단상, 책상, 의자, 가벽 등). 박스로 단순화. */
export const StageObject = z.object({
  id: Id,
  name: z.string(),
  kind: z.enum(["platform", "desk", "chair", "wall", "other"]),
  /** 바닥 중심 위치 */
  position: Vec3,
  /** 크기(m): 폭(x) · 높이(y) · 깊이(z) */
  size: Vec3,
  /** y축 회전(도) */
  rotation: z.number().default(0),
});
export type StageObject = z.infer<typeof StageObject>;

/** 키가 안 적혀 있을 때 쓰는 기본값(m). */
export const DEFAULT_CHARACTER_HEIGHT = 1.7;

/** 인물. 배우가 아니라 인물 기준이라 더블캐스트여도 데이터는 한 벌. 실명은 넣지 않는다. */
export const Character = z.object({
  id: Id,
  /** 역할명. 예: "판사" */
  role: z.string(),
  /** 화면에 표시할 짧은 이름. 예: "판사", "배우 A" */
  label: z.string(),
  /** 키(m). 없으면 DEFAULT_CHARACTER_HEIGHT */
  height: z.number().positive().optional(),
  /** 화면 표시 색 (#rrggbb) */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type Character = z.infer<typeof Character>;

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

export const Cue = z.object({
  id: Id,
  /** 큐 번호. 소수 허용(12.5) */
  number: z.number().nonnegative(),
  label: z.string(),
  /** 이 큐로 넘어올 때 걸리는 시간(초) */
  fadeIn: z.number().nonnegative(),
  /** 이 큐가 속한 장 */
  sceneId: Id.optional(),
  lights: z.array(CueState).default([]),
  blocking: z.array(Blocking).default([]),
  note: z.string().optional(),
});
export type Cue = z.infer<typeof Cue>;

/** 장. 큐를 담는 상자가 아니라 이름표 목록. 큐가 sceneId로 가리킨다. 공연 순서대로 적는다. */
export const Scene = z.object({ id: Id, name: z.string() });
export type Scene = z.infer<typeof Scene>;

/** 공연. 공연장(Stage)은 소유하지 않고 id로 골라 참조한다. */
export const Project = z.object({
  id: Id,
  title: z.string(),
  stageId: Id,
  /** 이 공연에서만 바꾸는 막 상태. 예: { "draw-2": true } = 2번 막 닫음 */
  curtainOverrides: z.record(z.string(), z.boolean()).default({}),
  objects: z.array(StageObject),
  characters: z.array(Character),
  scenes: z.array(Scene).default([]),
  /** 공연 전체 큐를 한 줄로. 큐 번호 순서대로 정렬돼 있어야 함 */
  cues: z.array(Cue),
  dataVersion: z.string(),
});
export type Project = z.infer<typeof Project>;
