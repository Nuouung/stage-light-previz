import { z } from "zod";
import { Id, Vec3 } from "./common";

/** 조명기 "종류". 같은 프레넬 22대는 종류 1개 + 걸린 조명 22개. */
export const FixtureType = z.object({
  id: Id,
  name: z.string(),
  /** 실제 기종이 아니라 범용 템플릿인지 */
  generic: z.boolean(),
  /** soft = 프레넬·워시처럼 가장자리가 퍼짐 / hard = 프로파일처럼 칼같이 잘림 */
  optics: z.enum(["soft", "hard"]),
  /** 줌 범위(도). [최소, 최대] */
  beamAngle: z.tuple([z.number().positive(), z.number().positive()]),
  colorSystem: z.enum(["none", "cct", "rgbw"]),
  /** colorSystem이 cct일 때 색온도 범위(K) */
  cctRange: z.tuple([z.number(), z.number()]).optional(),
  /** 기종 간 밝기 비율 (0~1) */
  relativeOutput: z.number().min(0).max(1),
  features: z.array(z.enum(["panTilt", "shutters", "gobo", "barndoor"])),
});
export type FixtureType = z.infer<typeof FixtureType>;

/**
 * 이 공연에 걸린 조명 한 대. 배치(Staging)의 행잉에 속한다.
 * 어느 배튼에 걸고, 몇 번 채널로 부르고, 어디를 겨누는지는 공연마다 다르다.
 */
export const Fixture = z.object({
  id: Id,
  typeId: Id,
  positionId: Id,
  /** 배튼 위 좌우 위치(m) */
  x: z.number(),
  /** 콘솔에서 부르는 채널 번호 */
  channelNo: z.number().int().positive(),
  /** 기본 포커스: 겨누는 지점 */
  aim: Vec3,
  /** 기본 포커스: 줌(도) */
  beamAngle: z.number().positive(),
  /** 자유 메모. 프로그램이 해석하지 않는다. 예: "프런트 키 · 앞줄 하수" */
  note: z.string().optional(),
});
export type Fixture = z.infer<typeof Fixture>;
