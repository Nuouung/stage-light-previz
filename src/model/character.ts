import { DEFAULT_CHARACTER_HEIGHT, type Character } from "./project";

/** 인물의 키(m). 안 적혀 있으면 기본값 1.7m. */
export function characterHeight(c: Character): number {
  return c.height ?? DEFAULT_CHARACTER_HEIGHT;
}

/** 얼굴(눈) 높이 대략값(m). 서 있으면 키의 93%, 앉으면 키의 약 0.68배로 본다. */
export function faceHeight(c: Character, posture: "stand" | "sit" = "stand"): number {
  const h = characterHeight(c);
  return posture === "sit" ? h * 0.68 : h * 0.93;
}
