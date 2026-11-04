import { describe, expect, it } from "vitest";
import { planChanges } from "../src/view/stage3d/changes";
import type { Shape } from "../src/view/stage3d/shapes";

const box = (id: string, over: Partial<Shape> = {}): Shape => ({
  id, group: "curtain", kind: "box", position: { x: 0, y: 0, z: 1 }, size: { x: 1, y: 1, z: 1 }, color: "#000000", ...over,
});
const person = (id: string, over: Partial<Shape> = {}): Shape => ({
  id, group: "character", kind: "figure", position: { x: 0, y: 0, z: 1 }, size: { x: 0.45, y: 1.7, z: 0.3 }, rotationY: 0, pose: "stand", color: "#ff0000", ...over,
});
const live = (...shapes: Shape[]) => new Map(shapes.map((s) => [s.id, s]));
const ids = (shapes: Shape[]) => shapes.map((s) => s.id);

describe("이전 무대와 새 무대 비교", () => {
  it("내용이 같으면 아무것도 바꾸지 않는다", () => {
    expect(planChanges(live(box("a"), person("p")), [box("a"), person("p")])).toEqual({ add: [], remove: [], replace: [], move: [] });
  });

  it("처음 그릴 때는 전부 새로 만든다", () => {
    expect(ids(planChanges(new Map(), [box("a"), person("p")]).add)).toEqual(["a", "p"]);
  });

  it("목록에서 빠진 물체는 치운다", () => {
    expect(planChanges(live(box("a"), box("b")), [box("a")]).remove).toEqual(["b"]);
  });

  it("막이 열려 id가 바뀌면 닫힌 막을 치우고 열린 막을 만든다", () => {
    const c = planChanges(live(box("draw-2")), [box("draw-2-l"), box("draw-2-r")]);
    expect(c.remove).toEqual(["draw-2"]);
    expect(ids(c.add)).toEqual(["draw-2-l", "draw-2-r"]);
  });

  it("인물의 위치만 바뀌면 다시 만들지 않고 옮긴다", () => {
    const c = planChanges(live(person("p")), [person("p", { position: { x: 2, y: 0, z: 1 } })]);
    expect(ids(c.move)).toEqual(["p"]);
    expect(c.replace).toEqual([]);
  });

  it("인물의 방향만 바뀌면 다시 만들지 않고 돌린다", () => {
    expect(ids(planChanges(live(person("p")), [person("p", { rotationY: 90 })]).move)).toEqual(["p"]);
  });

  it("인물의 자세가 바뀌면 새로 만든다", () => {
    const c = planChanges(live(person("p")), [person("p", { pose: "sit", position: { x: 2, y: 0, z: 1 } })]);
    expect(ids(c.replace)).toEqual(["p"]);
    expect(c.move).toEqual([]);
  });

  it("인물의 키나 색이 바뀌면 새로 만든다", () => {
    expect(ids(planChanges(live(person("p")), [person("p", { size: { x: 0.45, y: 1.6, z: 0.3 } })]).replace)).toEqual(["p"]);
    expect(ids(planChanges(live(person("p")), [person("p", { color: "#00ff00" })]).replace)).toEqual(["p"]);
  });

  it("인물의 겉모습이 바뀌면 새로 만든다", () => {
    expect(ids(planChanges(live(person("p")), [person("p", { appearance: { top: { color: "#112233" } } })]).replace)).toEqual(["p"]);
  });

  it("인물이 아닌 물체는 위치가 바뀌어도 새로 만든다", () => {
    expect(ids(planChanges(live(box("a")), [box("a", { position: { x: 1, y: 0, z: 1 } })]).replace)).toEqual(["a"]);
  });

  it("물체의 종류가 바뀌면 새로 만든다", () => {
    expect(ids(planChanges(live(box("a")), [person("a")]).replace)).toEqual(["a"]);
  });
});
