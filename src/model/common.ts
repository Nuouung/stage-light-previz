import { z } from "zod";

/**
 * 좌표계 (모든 데이터 공통)
 * - 원점: 무대 앞끝 중앙, 무대 바닥 높이
 * - 단위: 미터(m)
 * - x: 객석에서 볼 때 오른쪽(상수 쪽)이 +
 * - y: 위쪽이 +
 * - z: 무대 안쪽(객석에서 멀어지는 쪽)이 +
 */
export const Vec3 = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vec3 = z.infer<typeof Vec3>;

/** 데이터끼리 서로 가리킬 때 쓰는 이름표. 영문 소문자·숫자·하이픈만. */
export const Id = z.string().regex(/^[a-z0-9-]+$/, "id는 영문 소문자, 숫자, 하이픈만 쓸 수 있음");
export type Id = z.infer<typeof Id>;

/** 조명 색. RGB(+W) 혼합이거나 흰색 색온도(K) 중 하나. */
export const LightColor = z.union([
  z.object({ r: z.number().min(0).max(255), g: z.number().min(0).max(255), b: z.number().min(0).max(255), w: z.number().min(0).max(255).optional() }),
  z.object({ cct: z.number().min(1000).max(20000) }),
]);
export type LightColor = z.infer<typeof LightColor>;
