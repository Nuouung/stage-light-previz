import { describe, expect, it } from "vitest";
import { characterHeight, faceHeight, Stage } from "../src/model";
import { composeStage } from "../src/stage/compose";
import bonomaru from "../data/stages/bonomaru.json";
import { tinyProject } from "./fixtures";

describe("공연용 무대 합성", () => {
  const stage = Stage.parse({ ...bonomaru, id: "s" });

  it("공연에서 2번 막을 닫으면 합성된 무대에서 닫혀 있다", () => {
    const project = { ...tinyProject(), curtainOverrides: { "draw-2": true } };
    const composed = composeStage(stage, project);
    expect(composed.curtains.find((c) => c.id === "draw-2")?.closed).toBe(true);
  });

  it("합성해도 공연장 원본의 막 상태는 바뀌지 않는다", () => {
    const project = { ...tinyProject(), curtainOverrides: { "draw-2": true } };
    composeStage(stage, project);
    expect(stage.curtains.find((c) => c.id === "draw-2")?.closed).toBe(false);
  });

  it("공연이 고른 공연장이 아니면 에러가 난다", () => {
    expect(() => composeStage(stage, { ...tinyProject(), stageId: "other" })).toThrow();
  });
});

describe("인물 키", () => {
  it("키가 안 적혀 있으면 1.7m로 계산한다", () => {
    expect(characterHeight({ id: "x", role: "r", label: "l" })).toBe(1.7);
  });

  it("앉으면 얼굴 높이가 서 있을 때보다 낮다", () => {
    const c = { id: "x", role: "r", label: "l" };
    expect(faceHeight(c, "sit")).toBeLessThan(faceHeight(c, "stand"));
  });
});
