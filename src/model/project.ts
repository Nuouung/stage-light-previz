import { z } from "zod";
import { Id, Vec3 } from "./common";

/**
 * 작품(Project): 공연장이 바뀌어도 그대로 가져가는 것.
 * 대본·인물·장·세트 정의·큐 목록. 좌표나 조명값처럼 공연장마다 달라지는 건 넣지 않는다(→ Staging).
 */

/** 세트 물체의 정의 (트럭에 싣고 다니는 것). 어디 놓을지는 Staging에서 정한다. 박스로 단순화. */
export const StageObject = z.object({
  id: Id,
  name: z.string(),
  kind: z.enum(["platform", "desk", "chair", "wall", "other"]),
  /** 크기(m): 폭(x) · 높이(y) · 깊이(z) */
  size: Vec3,
});
export type StageObject = z.infer<typeof StageObject>;

/** 키가 안 적혀 있을 때 쓰는 기본값(m). */
export const DEFAULT_CHARACTER_HEIGHT = 1.7;

/** 인물. 배우가 아니라 인물 기준이라 더블캐스트여도 데이터는 한 벌. 실명은 넣지 않는다. */
export const Character = z.object({
  id: Id,
  /** 역할명. 예: "판사" */
  role: z.string(),
  /** 화면에 표시할 짧은 이름 */
  label: z.string(),
  /** 키(m). 없으면 DEFAULT_CHARACTER_HEIGHT */
  height: z.number().positive().optional(),
  /** 화면 표시 색 (#rrggbb) */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
export type Character = z.infer<typeof Character>;

/** 장. 큐를 담는 상자가 아니라 이름표 목록. 큐가 sceneId로 가리킨다. 공연 순서대로 적는다. */
export const Scene = z.object({ id: Id, name: z.string() });
export type Scene = z.infer<typeof Scene>;

/** 큐 목록의 한 줄. 공연장과 무관한 정보만. 이 큐에서 조명·인물이 어떻게 되는지는 Staging에. */
export const Cue = z.object({
  id: Id,
  /** 큐 번호. 소수 허용(12.5) */
  number: z.number().nonnegative(),
  label: z.string(),
  /** 이 큐로 넘어올 때 걸리는 시간(초) */
  fadeIn: z.number().nonnegative(),
  /** 이 큐가 속한 장 */
  sceneId: Id.optional(),
  note: z.string().optional(),
});
export type Cue = z.infer<typeof Cue>;

export const Project = z.object({
  id: Id,
  title: z.string(),
  objects: z.array(StageObject),
  characters: z.array(Character),
  scenes: z.array(Scene).default([]),
  /** 공연 전체 큐를 한 줄로. 큐 번호 순서대로 정렬돼 있어야 함 */
  cues: z.array(Cue),
  dataVersion: z.string(),
});
export type Project = z.infer<typeof Project>;
