import { describe, expect, it } from "vitest";
import { Project, Stage, Staging } from "../src/model";
import { resolveCue } from "../src/player";
import { composeStage } from "../src/stage/compose";
import { describeCharacters, describeStage, floorHeightAt } from "../src/view/stage3d/shapes";
import bonomaru from "../data/stages/bonomaru.json";
import bodojichim from "../data/projects/bodojichim.json";
import bodojichimBonomaru from "../data/stagings/bodojichim-bonomaru.json";

const stage = Stage.parse(bonomaru);
const project = Project.parse(bodojichim);
const staging = Staging.parse(bodojichimBonomaru);
const composed = (overrides: Record<string, boolean>) => composeStage(stage, project, { ...staging, curtainOverrides: overrides });

describe("무대 그리기 목록", () => {
  it("2번 막을 닫으면 4.85m에 무대 폭 전체를 가리는 막이 생긴다", () => {
    const draw2 = describeStage(composed({ "draw-2": true })).find((s) => s.id === "draw-2");
    expect(draw2?.position.z).toBe(4.85);
    expect(draw2?.size.x).toBe(stage.width);
  });

  it("2번 막을 열면 가운데를 가리지 않고 양옆에 모여 있다", () => {
    const shapes = describeStage(composed({ "draw-2": false }));
    expect(shapes.find((s) => s.id === "draw-2")).toBeUndefined();
    expect(shapes.filter((s) => s.id.startsWith("draw-2-"))).toHaveLength(2);
  });

  it("배튼마다 막대가 하나씩 그려진다", () => {
    const battens = describeStage(composed({})).filter((s) => s.group === "batten");
    expect(battens).toHaveLength(stage.positions.length);
  });

  it("바닥은 공연장에 적힌 바닥 색으로 그려진다", () => {
    expect(describeStage(composed({})).find((s) => s.id === "floor")?.color).toBe(stage.floorColor);
  });
});

describe("인물 그리기", () => {
  it("단을 겹쳐 쌓은 곳에서는 가장 위층 윗면에 선다", () => {
    const c = composed({});
    const tops = c.objects.filter((o) => o.kind === "platform").map((o) => o.position.y + o.size.y);
    const top = c.objects.find((o) => o.kind === "platform" && o.position.y + o.size.y === Math.max(...tops))!;
    expect(floorHeightAt(c, top.position.x, top.position.z)).toBeCloseTo(Math.max(...tops));
  });

  it("무대에 나와 있는 인물만 그려진다", () => {
    const c = composed({});
    const look = resolveCue(project, staging, project.cues[0]!.id);
    const onStage = Object.values(look.characters).filter((l) => l.onStage).length;
    expect(describeCharacters(c, project, look.characters)).toHaveLength(onStage);
  });

  it("인물은 키와 자세를 가진 사람 모형으로 그려진다", () => {
    const c = composed({});
    const look = resolveCue(project, staging, project.cues[0]!.id);
    const fig = describeCharacters(c, project, look.characters)[0]!;
    expect(fig).toMatchObject({ kind: "figure", size: { y: 1.7 }, pose: "stand" });
  });
});
