import { z } from "zod";
import { Id } from "./common";
import { Fixture } from "./fixture";

/** 막. z = 무대 앞끝에서의 깊이(m). closed = 공연장 기본 상태. */
export const Curtain = z.object({
  id: Id,
  name: z.string(),
  /** draw = 여닫는 막 / border = 위쪽 가림막 / screen = 흰 스크린 */
  kind: z.enum(["draw", "border", "screen"]).default("draw"),
  z: z.number().nonnegative(),
  closed: z.boolean(),
});
export type Curtain = z.infer<typeof Curtain>;

/** 조명을 거는 자리(배튼 등). */
export const Position = z.object({
  id: Id,
  name: z.string(),
  /** foh = 객석 위 / sus = 무대 위 조명 배튼 / set = 무대 위 세트 배튼 / side·floor = 옆·바닥 */
  kind: z.enum(["foh", "sus", "set", "side", "floor"]),
  /** 높이(m) */
  y: z.number(),
  /** 깊이(m). 객석 위는 음수 */
  z: z.number(),
  xRange: z.tuple([z.number(), z.number()]),
});
export type Position = z.infer<typeof Position>;

/**
 * 공연장. 어떤 공연(Project)에도 속하지 않는다.
 * 여러 공연이 같은 공연장을 골라 쓸 수 있다.
 */
export const Stage = z.object({
  id: Id,
  venue: z.string(),
  /** 연기 공간 폭(m) */
  width: z.number().positive(),
  /** 연기 공간 깊이(m) */
  depth: z.number().positive(),
  /** 무대 바닥 높이(객석 바닥 기준, m). 블랙박스면 0 */
  deckHeight: z.number().nonnegative(),
  /** 무대 바닥 색 (#rrggbb) */
  floorColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  curtains: z.array(Curtain),
  positions: z.array(Position),
  fixtures: z.array(Fixture),
  /** 아직 실측·확인 안 된 값에 대한 메모 */
  notes: z.array(z.string()).default([]),
});
export type Stage = z.infer<typeof Stage>;
