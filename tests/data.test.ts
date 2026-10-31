import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FixtureType, Project, Stage } from "../src/model";

const root = join(import.meta.dirname, "..", "data");
const load = (dir: string) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: `${dir}/${f}`, json: JSON.parse(readFileSync(join(root, dir, f), "utf8")) }));

const types = load("fixture-types").map(({ file, json }) => ({ file, data: FixtureType.parse(json) }));
const stages = load("stages").map(({ file, json }) => ({ file, data: Stage.parse(json) }));
const projects = load("projects").map(({ file, json }) => ({ file, data: Project.parse(json) }));

describe("데이터 형식", () => {
  it("모든 데이터 파일이 정해진 형식에 맞는다", () => {
    expect(types.length + stages.length + projects.length).toBeGreaterThan(0);
  });
});

describe("데이터 연결", () => {
  const typeIds = new Set(types.map((t) => t.data.id));

  for (const { file, data: stage } of stages) {
    it(`${file}: 걸린 조명은 모두 있는 종류와 있는 배튼을 가리킨다`, () => {
      const positionIds = new Set(stage.positions.map((p) => p.id));
      for (const f of stage.fixtures) {
        expect(typeIds, `${f.id}의 종류`).toContain(f.typeId);
        expect(positionIds, `${f.id}의 배튼`).toContain(f.positionId);
      }
    });

    it(`${file}: 채널 번호가 겹치지 않는다`, () => {
      const nums = stage.fixtures.map((f) => f.channelNo);
      expect(new Set(nums).size).toBe(nums.length);
    });
  }

  for (const { file, data: project } of projects) {
    const stage = stages.find((s) => s.data.id === project.stageId)?.data;

    it(`${file}: 고른 공연장이 존재한다`, () => {
      expect(stage, `공연장 ${project.stageId}`).toBeDefined();
    });

    it(`${file}: 큐가 참조하는 조명·인물·막이 모두 존재한다`, () => {
      const fixtureIds = new Set(stage?.fixtures.map((f) => f.id));
      const characterIds = new Set(project.characters.map((c) => c.id));
      const curtainIds = new Set(stage?.curtains.map((c) => c.id));
      for (const id of Object.keys(project.curtainOverrides)) expect(curtainIds, `막 ${id}`).toContain(id);
      for (const cue of project.cues) {
        for (const l of cue.lights) expect(fixtureIds, `${cue.id}의 조명`).toContain(l.fixtureId);
        for (const b of cue.blocking) expect(characterIds, `${cue.id}의 인물`).toContain(b.characterId);
      }
    });

    it(`${file}: 큐 번호가 오름차순이다`, () => {
      const nums = project.cues.map((c) => c.number);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    });
  }
});
