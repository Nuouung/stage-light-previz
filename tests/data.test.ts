import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FixtureType, Project, Stage, Staging } from "../src/model";
import { inventoryWarnings } from "../src/stage/inventory";

const root = join(import.meta.dirname, "..", "data");
const load = (dir: string) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: `${dir}/${f}`, json: JSON.parse(readFileSync(join(root, dir, f), "utf8")) }));

const types = load("fixture-types").map(({ file, json }) => ({ file, data: FixtureType.parse(json) }));
const stages = load("stages").map(({ file, json }) => ({ file, data: Stage.parse(json) }));
const projects = load("projects").map(({ file, json }) => ({ file, data: Project.parse(json) }));
const stagings = load("stagings").map(({ file, json }) => ({ file, data: Staging.parse(json) }));

describe("데이터 형식", () => {
  it("모든 데이터 파일이 정해진 형식에 맞는다", () => {
    expect(types.length + stages.length + projects.length + stagings.length).toBeGreaterThan(0);
  });
});

describe("공연장 데이터", () => {
  for (const { file, data: stage } of stages) {
    it(`${file}: 보유 장비는 모두 있는 종류를 가리키고 겹치지 않는다`, () => {
      const typeIds = new Set(types.map((t) => t.data.id));
      for (const i of stage.inventory) expect(typeIds, `보유 장비 ${i.typeId}`).toContain(i.typeId);
      expect(new Set(stage.inventory.map((i) => i.typeId)).size).toBe(stage.inventory.length);
    });
  }
});

describe("작품 데이터", () => {
  for (const { file, data: project } of projects) {
    it(`${file}: 큐가 가리키는 장이 모두 존재한다`, () => {
      const sceneIds = new Set(project.scenes.map((s) => s.id));
      for (const cue of project.cues) if (cue.sceneId) expect(sceneIds, `${cue.id}의 장`).toContain(cue.sceneId);
    });

    it(`${file}: 인물 id가 겹치지 않는다`, () => {
      const ids = project.characters.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it(`${file}: 큐 번호가 오름차순이다`, () => {
      const nums = project.cues.map((c) => c.number);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
    });
  }
});

describe("배치 데이터", () => {
  for (const { file, data: staging } of stagings) {
    const project = projects.find((p) => p.data.id === staging.projectId)?.data;
    const stage = stages.find((s) => s.data.id === staging.stageId)?.data;

    it(`${file}: 가리키는 작품과 공연장이 존재한다`, () => {
      expect(project, `작품 ${staging.projectId}`).toBeDefined();
      expect(stage, `공연장 ${staging.stageId}`).toBeDefined();
    });

    it(`${file}: 놓은 물체·바꾼 막이 모두 존재한다`, () => {
      const objectIds = new Set(project?.objects.map((o) => o.id));
      const curtainIds = new Set(stage?.curtains.map((c) => c.id));
      for (const p of staging.placements) expect(objectIds, `물체 ${p.objectId}`).toContain(p.objectId);
      for (const id of Object.keys(staging.curtainOverrides)) expect(curtainIds, `막 ${id}`).toContain(id);
    });

    it(`${file}: 놓은 물체가 모두 연기 공간 안에 들어간다`, () => {
      const area = staging.actingArea;
      if (!area) return;
      for (const p of staging.placements) {
        const o = project?.objects.find((d) => d.id === p.objectId);
        if (!o) continue;
        // 위에서 본 바닥 면적. 넘어진 의자는 높이가 바닥 길이가 된다
        const sx = o.size.x;
        const sz = p.tipped ? o.size.y : o.size.z;
        const r = (p.rotation * Math.PI) / 180;
        const hx = (Math.abs(Math.cos(r)) * sx + Math.abs(Math.sin(r)) * sz) / 2;
        const hz = (Math.abs(Math.sin(r)) * sx + Math.abs(Math.cos(r)) * sz) / 2;
        expect(Math.abs(p.position.x) + hx, `${o.id} 가로`).toBeLessThanOrEqual(area.width / 2 + 0.01);
        expect(p.position.z + hz, `${o.id} 깊이`).toBeLessThanOrEqual(area.depth + 0.01);
      }
    });

    it(`${file}: 걸린 조명은 모두 있는 종류와 이 공연장의 배튼을 가리킨다`, () => {
      const typeIds = new Set(types.map((t) => t.data.id));
      const positionIds = new Set(stage?.positions.map((p) => p.id));
      for (const f of staging.hanging) {
        expect(typeIds, `${f.id}의 종류`).toContain(f.typeId);
        expect(positionIds, `${f.id}의 배튼`).toContain(f.positionId);
      }
    });

    it(`${file}: 걸린 조명의 id와 채널 번호가 겹치지 않는다`, () => {
      const ids = staging.hanging.map((f) => f.id);
      const nums = staging.hanging.map((f) => f.channelNo);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(nums).size).toBe(nums.length);
    });

    it(`${file}: 걸린 조명은 배튼 길이 안에 있다`, () => {
      for (const f of staging.hanging) {
        const p = stage?.positions.find((q) => q.id === f.positionId);
        if (!p) continue;
        expect(f.x, `${f.id} 좌우 위치`).toBeGreaterThanOrEqual(p.xRange[0]);
        expect(f.x, `${f.id} 좌우 위치`).toBeLessThanOrEqual(p.xRange[1]);
      }
    });

    it(`${file}: 보유 수량을 넘겨 걸면 경고를 남긴다`, () => {
      // 대여 장비가 있을 수 있어 실패로 처리하지 않는다
      if (stage) inventoryWarnings(stage, staging).forEach((w) => console.warn(`${file}: ${w}`));
    });

    it(`${file}: 기본 줌은 조명 종류의 범위 안에 있다`, () => {
      for (const f of staging.hanging) {
        const t = types.find((d) => d.data.id === f.typeId)?.data;
        if (!t) continue;
        expect(f.beamAngle, `${f.id} 줌`).toBeGreaterThanOrEqual(t.beamAngle[0]);
        expect(f.beamAngle, `${f.id} 줌`).toBeLessThanOrEqual(t.beamAngle[1]);
      }
    });

    it(`${file}: 큐 값이 가리키는 큐·조명·인물이 모두 존재한다`, () => {
      const cueIds = new Set(project?.cues.map((c) => c.id));
      const fixtureIds = new Set(staging.hanging.map((f) => f.id));
      const characterIds = new Set(project?.characters.map((c) => c.id));
      for (const v of staging.cues) {
        expect(cueIds, `큐 ${v.cueId}`).toContain(v.cueId);
        for (const l of v.lights) expect(fixtureIds, `${v.cueId}의 조명`).toContain(l.fixtureId);
        for (const b of v.blocking) expect(characterIds, `${v.cueId}의 인물`).toContain(b.characterId);
      }
    });
  }
});
