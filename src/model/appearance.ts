import { z } from "zod";

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
/** 평균 체형을 1로 본 배율. 키는 Character.height가 따로 정한다. */
const Ratio = z.number().min(0.75).max(1.3);

/**
 * 인물의 겉모습. 전부 선택 항목이고, 안 적으면 기본 인물로 그린다.
 * 체형·머리·얼굴·의상을 인물 데이터로 두고, 메시와 리그는 뷰가 공통으로 만든다.
 */
export const Appearance = z.object({
  body: z.object({ shoulders: Ratio, waist: Ratio, hips: Ratio, girth: Ratio }).partial().optional(),
  face: z.object({ jaw: Ratio, skin: Hex }).partial().optional(),
  hair: z.object({ style: z.enum(["short"]), color: Hex }).partial().optional(),
  top: z.object({ style: z.enum(["shirt"]), sleeve: z.enum(["long", "rolled"]), color: Hex }).partial().optional(),
  bottom: z.object({ style: z.enum(["trousers"]), color: Hex }).partial().optional(),
  shoes: z.object({ color: Hex }).partial().optional(),
});
export type Appearance = z.infer<typeof Appearance>;

/** 빈칸을 모두 채운 겉모습. */
export type ResolvedAppearance = {
  body: { shoulders: number; waist: number; hips: number; girth: number };
  face: { jaw: number; skin: string };
  hair: { style: "short"; color: string };
  top: { style: "shirt"; sleeve: "long" | "rolled"; color: string };
  bottom: { style: "trousers"; color: string };
  shoes: { color: string };
};

export const DEFAULT_APPEARANCE: ResolvedAppearance = {
  body: { shoulders: 1, waist: 1, hips: 1, girth: 1 },
  face: { jaw: 1, skin: "#c79a7c" },
  hair: { style: "short", color: "#1d1815" },
  top: { style: "shirt", sleeve: "rolled", color: "#8c97a3" },
  bottom: { style: "trousers", color: "#2f343d" },
  shoes: { color: "#241a14" },
};

export function resolveAppearance(a?: Appearance): ResolvedAppearance {
  const d = DEFAULT_APPEARANCE;
  return {
    body: { ...d.body, ...a?.body },
    face: { ...d.face, ...a?.face },
    hair: { ...d.hair, ...a?.hair },
    top: { ...d.top, ...a?.top },
    bottom: { ...d.bottom, ...a?.bottom },
    shoes: { ...d.shoes, ...a?.shoes },
  };
}
