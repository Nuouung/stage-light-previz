import { describe, expect, it } from "vitest";
import { characterHeight, CueState, faceHeight, Stage } from "../src/model";
import { composeStage } from "../src/stage/compose";
import bonomaru from "../data/stages/bonomaru.json";
import { tinyProject, tinyStaging } from "./fixtures";

describe("공연용 무대 합성", () => {
  const stage = Stage.parse({ ...bonomaru, id: "s" });

  it("배치에서 2번 막을 닫으면 합성된 무대에서 닫혀 있다", () => {
    const staging = { ...tinyStaging(), curtainOverrides: { "draw-2": true } };
    const composed = composeStage(stage, tinyProject(), staging);
    expect(composed.curtains.find((c) => c.id === "draw-2")?.closed).toBe(true);
  });

  it("합성해도 공연장 원본의 막 상태는 바뀌지 않는다", () => {
    composeStage(stage, tinyProject(), { ...tinyStaging(), curtainOverrides: { "draw-2": true } });
    expect(stage.curtains.find((c) => c.id === "draw-2")?.closed).toBe(false);
  });

  it("물체는 작품의 크기와 배치의 위치를 합쳐서 놓인다", () => {
    const box = composeStage(stage, tinyProject(), tinyStaging()).objects[0];
    expect(box).toMatchObject({ id: "box", size: { y: 0.4 }, position: { z: 3 } });
  });

  it("배치에 위치가 없는 물체는 무대에 나오지 않는다", () => {
    const staging = { ...tinyStaging(), placements: [] };
    expect(composeStage(stage, tinyProject(), staging).objects).toHaveLength(0);
  });

  it("걸린 조명은 공연장이 아니라 배치의 행잉에서 온다", () => {
    const fixture = { id: "f", typeId: "t", positionId: "p", x: 0, channelNo: 1, aim: { x: 0, y: 0, z: 0 }, beamAngle: 30 };
    const composed = composeStage(stage, tinyProject(), { ...tinyStaging(), hanging: [fixture] });
    expect(composed.fixtures).toEqual([fixture]);
  });

  it("다른 공연장이나 다른 작품용 배치를 넣으면 에러가 난다", () => {
    expect(() => composeStage(stage, tinyProject(), { ...tinyStaging(), stageId: "other" })).toThrow();
    expect(() => composeStage(stage, tinyProject(), { ...tinyStaging(), projectId: "other" })).toThrow();
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

describe("큐의 조명값", () => {
  it("밝기와 색은 큐에 적을 수 있다", () => {
    expect(CueState.safeParse({ fixtureId: "a", intensity: 50, color: { cct: 3200 } }).success).toBe(true);
  });

  it("줌이나 겨누는 값을 큐에 적으면 데이터 검사에서 걸린다", () => {
    expect(CueState.safeParse({ fixtureId: "a", beamAngle: 30 }).success).toBe(false);
    expect(CueState.safeParse({ fixtureId: "a", pan: 10 }).success).toBe(false);
  });
});
