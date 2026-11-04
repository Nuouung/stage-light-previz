import { describe, expect, it } from "vitest";
import { characterHeight, DIRECTIONS, Project, Stage, Staging, ZONES } from "../src/model";
import { resolveCue } from "../src/player";
import { composeStage } from "../src/stage/compose";
import { cctToRgb, describeLights, zoneCenter } from "../src/view/stage3d/lights";
import { describeActingArea, describeCharacters, describeStage, floorHeightAt } from "../src/view/stage3d/shapes";
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
    const ch = project.characters[0]!;
    const fig = describeCharacters(c, project, { [ch.id]: { x: 0, z: 1, posture: "stand", onStage: true } })[0]!;
    expect(fig).toMatchObject({ kind: "figure", size: { y: characterHeight(ch) }, pose: "stand" });
  });

  it("프리셋에서는 무대에 아무도 없다", () => {
    const look = resolveCue(project, staging, project.cues[0]!.id);
    expect(describeCharacters(composed({}), project, look.characters)).toHaveLength(0);
  });
});

describe("그릴 것 목록의 id", () => {
  it("물체마다 id가 달라 이전 무대와 비교할 수 있다", () => {
    const c = composed({ "draw-2": true });
    const look = resolveCue(project, staging, "cue-1");
    const shapes = [...describeStage(c), ...describeActingArea(staging.actingArea), ...describeCharacters(c, project, look.characters)];
    expect(new Set(shapes.map((s) => s.id)).size).toBe(shapes.length);
  });
});

describe("가구 그리기", () => {
  it("책상은 테이블 모형, 의자는 의자 모형으로 그려진다", () => {
    const shapes = describeStage(composed({}));
    expect(shapes.find((s) => s.id === "desk-judge")?.kind).toBe("table");
    expect(shapes.find((s) => s.id === "chair-judge")?.kind).toBe("chair");
  });

  it("엎어 놓은 의자는 넘어진 상태로 그려진다", () => {
    const shapes = describeStage(composed({}));
    expect(shapes.find((s) => s.id === "chair-down-left")?.tipped).toBe(true);
    expect(shapes.find((s) => s.id === "chair-judge")?.tipped).toBe(false);
  });
});

describe("연기 공간 표시", () => {
  it("폭 7m·깊이 5m면 테이프 4줄이 그 경계에 붙는다", () => {
    const tapes = describeActingArea({ width: 7, depth: 5 });
    expect(tapes).toHaveLength(4);
    const right = tapes.find((s) => s.id === "acting-right")!;
    expect(right.position.x + right.size.x / 2).toBeCloseTo(3.5);
    const back = tapes.find((s) => s.id === "acting-back")!;
    expect(back.position.z + back.size.z / 2).toBeCloseTo(5);
  });
});

describe("조명", () => {
  it("색온도 3200K는 붉은빛이 도는 흰색이고, 6500K는 거의 흰색이다", () => {
    const [r, g, b] = cctToRgb(3200);
    expect(r).toBeGreaterThan(b);
    const [r2, , b2] = cctToRgb(6500);
    expect(r2 - b2).toBeLessThan(5);
  });

  const area = { width: 8, depth: 5 };

  it("구역과 방향마다 빛이 하나씩 있다", () => {
    expect(describeLights(composed({}), area, {})).toHaveLength(ZONES.length * DIRECTIONS.length);
  });

  it("적은 밝기가 그 구역 그 방향의 빛에만 들어간다", () => {
    const beams = describeLights(composed({}), area, { "down-center/front": { intensity: 50 } });
    expect(beams.find((b) => b.id === "down-center/front")?.level).toBe(0.5);
    expect(beams.filter((b) => b.level > 0)).toHaveLength(1);
  });

  it("폭 배율을 적은 빛만 좁아진다", () => {
    const beams = describeLights(composed({}), area, { "down-center/front": { spread: 0.5 } });
    const base = describeLights(composed({}), area, {});
    const angle = (list: typeof beams, id: string) => list.find((b) => b.id === id)!.beamAngle;
    expect(angle(beams, "down-center/front")).toBeLessThan(angle(base, "down-center/front"));
    expect(angle(beams, "down-left/front")).toBe(angle(base, "down-left/front"));
  });

  it("겨눌 지점을 적은 빛만 그 지점을 비춘다", () => {
    const beams = describeLights(composed({}), area, { "down-center/top": { at: { x: 1, z: 2 } } });
    expect(beams.find((b) => b.id === "down-center/top")?.target).toMatchObject({ x: 1, z: 2 });
    expect(beams.find((b) => b.id === "down-center/back")?.target.x).toBe(zoneCenter("down-center", area).x);
  });

  it("왼쪽 구역은 객석에서 볼 때 왼쪽(-x), 앞줄은 객석 쪽이다", () => {
    expect(zoneCenter("down-left", area).x).toBeLessThan(0);
    expect(zoneCenter("up-right", area).x).toBeGreaterThan(0);
    expect(zoneCenter("down-center", area).z).toBeLessThan(zoneCenter("up-center", area).z);
  });

  it("프런트는 객석 쪽, 백은 무대 안쪽에서 비춘다", () => {
    const beams = describeLights(composed({}), area, {});
    const center = zoneCenter("down-center", area);
    expect(beams.find((b) => b.id === "down-center/front")!.position.z).toBeLessThan(center.z);
    expect(beams.find((b) => b.id === "down-center/back")!.position.z).toBeGreaterThan(center.z);
  });

  it("단이 있는 구역은 단 윗면을 겨눈다", () => {
    const beam = describeLights(composed({}), area, {}).find((b) => b.id === "up-center/top")!;
    expect(beam.target.y).toBeCloseTo(0.58);
  });
});
