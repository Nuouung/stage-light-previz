import * as THREE from "three";
import { describe, expect, it } from "vitest";
import bodojichim from "../data/projects/bodojichim.json";
import { Project, resolveAppearance, Stage, Staging } from "../src/model";
import bonomaru from "../data/stages/bonomaru.json";
import bodojichimBonomaru from "../data/stagings/bodojichim-bonomaru.json";
import { composeStage } from "../src/stage/compose";
import { buildFigure } from "../src/view/stage3d/figure";
import { buildHumanAsset, humanAsset } from "../src/view/stage3d/human/asset";
import { humanParts } from "../src/view/stage3d/human/parts";
import type { BoneName } from "../src/view/stage3d/human/rig";
import { ellipsoid } from "../src/view/stage3d/human/sdf";
import { surfaceNets } from "../src/view/stage3d/human/surfaceNets";
import { describeCharacters } from "../src/view/stage3d/shapes";

const asset = humanAsset(resolveAppearance());
const position = asset.geometry.getAttribute("position");

function rangeAt(axis: "x" | "y" | "z", within?: (x: number, y: number, z: number) => boolean) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const p = { x: position.getX(i), y: position.getY(i), z: position.getZ(i) };
    if (within && !within(p.x, p.y, p.z)) continue;
    lo = Math.min(lo, p[axis]);
    hi = Math.max(hi, p[axis]);
  }
  return [lo, hi] as const;
}

function worldY(figure: THREE.Group, bone: BoneName) {
  figure.updateMatrixWorld(true);
  return (figure.userData.bones as Map<BoneName, THREE.Bone>).get(bone)!.getWorldPosition(new THREE.Vector3()).y;
}

describe("표면 메시 만들기", () => {
  it("구를 넣으면 반지름이 맞고 삼각형 앞면이 바깥을 향한 메시가 나온다", () => {
    const { positions, indices } = surfaceNets(ellipsoid([0, 0, 0], [1, 1, 1]), { min: [-1.5, -1.5, -1.5], max: [1.5, 1.5, 1.5] }, 0.2);
    expect(indices.length).toBeGreaterThan(300);
    const at = (i: number) => new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [at(indices[i]!), at(indices[i + 1]!), at(indices[i + 2]!)];
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      expect(normal.dot(a.clone().add(b).add(c))).toBeGreaterThan(0);
      expect(a.length()).toBeCloseTo(1, 0);
    }
  });
});

describe("사람 비율", () => {
  it("발바닥은 바닥에 닿고 머리 꼭대기는 키와 거의 같다", () => {
    const [bottom, top] = rangeAt("y");
    expect(bottom).toBeCloseTo(0, 2);
    expect(top).toBeGreaterThan(0.99);
    expect(top).toBeLessThan(1.02);
  });

  it("머리 높이는 키의 7분의 1에서 8분의 1 사이다", () => {
    const [, top] = rangeAt("y");
    const [chin] = rangeAt("y", (x, y, z) => Math.abs(x) < 0.01 && z < -0.03 && y > 0.84);
    expect(top - chin).toBeGreaterThan(1 / 8);
    expect(top - chin).toBeLessThan(1 / 7);
  });

  it("어깨 폭은 키의 4분의 1 안팎이고 허리보다 넓다", () => {
    const [, shoulder] = rangeAt("x", (_x, y) => y > 0.76 && y < 0.82);
    const [, waist] = rangeAt("x", (x, y) => Math.abs(x) < 0.12 && y > 0.61 && y < 0.63);
    expect(shoulder * 2).toBeGreaterThan(0.24);
    expect(shoulder * 2).toBeLessThan(0.3);
    expect(shoulder).toBeGreaterThan(waist);
  });
});

describe("메시 부담", () => {
  it("한 명이 삼각형 25,000개를 넘지 않는다", () => {
    expect(asset.triangles).toBeLessThanOrEqual(25000);
  });

  it("체형이 같으면 메시를 다시 만들지 않고, 소매가 달라지면 새로 만든다", () => {
    expect(humanAsset(resolveAppearance({ top: { color: "#112233" } }))).toBe(asset);
    expect(humanAsset(resolveAppearance({ top: { sleeve: "long" } }))).not.toBe(asset);
  });
});

describe("리그와 자세", () => {
  it("모든 정점의 뼈 가중치 합은 1이다", () => {
    const weight = asset.geometry.getAttribute("skinWeight");
    for (let i = 0; i < weight.count; i += 37) {
      expect(weight.getX(i) + weight.getY(i) + weight.getZ(i) + weight.getW(i)).toBeCloseTo(1, 4);
    }
  });

  it("인물의 키는 그룹 배율로 반영된다", () => {
    expect(buildFigure(1.61, "stand", "#ff0000").scale.y).toBeCloseTo(1.61);
  });

  it("앉으면 엉덩이가 내려가고 발목은 바닥 높이에 남는다", () => {
    const stand = buildFigure(1.74, "stand", "#ff0000");
    const sit = buildFigure(1.74, "sit", "#ff0000");
    expect(worldY(sit, "hips")).toBeLessThan(worldY(stand, "hips") - 0.3);
    expect(worldY(sit, "footL")).toBeLessThan(0.12);
  });

  it("앉은 엉덩이 높이는 의자 좌판(0.45m)보다 위다", () => {
    expect(worldY(buildFigure(1.74, "sit", "#ff0000"), "hips")).toBeGreaterThan(0.45);
  });
});

describe("인물 데이터와 겉모습", () => {
  it("겉모습을 일부만 적으면 나머지는 기본값으로 채운다", () => {
    const look = resolveAppearance({ hair: { color: "#aaaaaa" }, body: { shoulders: 1.1 } });
    expect(look.hair).toMatchObject({ color: "#aaaaaa", style: "short" });
    expect(look.body).toMatchObject({ shoulders: 1.1, hips: 1 });
  });

  it("체형 배율을 올리면 어깨가 넓어진다", () => {
    const wide = buildHumanAsset(resolveAppearance({ body: { shoulders: 1.15 } }));
    const p = wide.geometry.getAttribute("position");
    let max = 0;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.76 && p.getY(i) < 0.82) max = Math.max(max, p.getX(i));
    expect(max).toBeGreaterThan(rangeAt("x", (_x, y) => y > 0.76 && y < 0.82)[1]);
  });

  it("작품 데이터에 적은 겉모습이 그리기 목록까지 전달된다", () => {
    const base = Project.parse(bodojichim);
    const ch = base.characters[0]!;
    const project = Project.parse({ ...base, characters: [{ ...ch, appearance: { top: { color: "#123456" } } }] });
    const composed = composeStage(Stage.parse(bonomaru), project, Staging.parse(bodojichimBonomaru));
    const [fig] = describeCharacters(composed, project, { [ch.id]: { x: 0, z: 1, posture: "stand", onStage: true } });
    expect(fig?.appearance?.top?.color).toBe("#123456");
  });

  it("겉모습 색이 잘못된 값이면 데이터 검사에서 걸린다", () => {
    const base = Project.parse(bodojichim);
    const bad = { ...base, characters: [{ ...base.characters[0]!, appearance: { top: { color: "파랑" } } }] };
    expect(Project.safeParse(bad).success).toBe(false);
  });
});

describe("부위 구성", () => {
  it("피부·상의·하의·신발·머리가 모두 있다", () => {
    const slots = new Set(humanParts(resolveAppearance()).map((p) => p.slot));
    expect([...slots].sort()).toEqual(["bottom", "hair", "shoes", "skin", "top"]);
  });
});
