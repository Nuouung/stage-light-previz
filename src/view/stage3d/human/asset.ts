import * as THREE from "three";
import type { ResolvedAppearance } from "../../../model/appearance";
import { humanParts, SLOTS, type Part, type Slot } from "./parts";
import { boneDefs, type BoneDef, type BoneName } from "./rig";
import { gradient, type Sdf } from "./sdf";
import { surfaceNets } from "./surfaceNets";

/** 메시 한 벌: 뼈 정의와 기하. 키는 1로 고정돼 있고, 키 차이는 그룹 배율로 준다. */
export type HumanAsset = {
  geometry: THREE.BufferGeometry;
  bones: BoneDef[];
  triangles: number;
  /** 부위별 삼각형 수 (점검용) */
  perPart: Record<string, number>;
  /** 가슴 앞 표면 위 한 점 (인물 식별 표시를 붙일 곳) */
  chestMark: [number, number, number];
};

type Built = { positions: number[]; normals: number[]; colors: number[]; indices: number[]; skinIndex: number[]; skinWeight: number[] };

/** 표면 위 정점이 얼마나 파묻혀 있는지(주변 차폐). 겨드랑이·턱 밑·가랑이가 어둡게 된다. */
function occlusion(f: Sdf, x: number, y: number, z: number, n: [number, number, number]): number {
  let hidden = 0;
  for (const [h, w] of [[0.012, 0.5], [0.026, 0.3], [0.05, 0.2]] as const) {
    hidden += (w * Math.max(0, h - f(x + n[0] * h, y + n[1] * h, z + n[2] * h))) / h;
  }
  return 1 - Math.min(1, hidden) * 0.65;
}

const pointSegment = (p: readonly number[], a: readonly number[], b: readonly number[]) => {
  const bx = b[0]! - a[0]!;
  const by = b[1]! - a[1]!;
  const bz = b[2]! - a[2]!;
  const px = p[0]! - a[0]!;
  const py = p[1]! - a[1]!;
  const pz = p[2]! - a[2]!;
  const t = Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz || 1)));
  return Math.hypot(px - bx * t, py - by * t, pz - bz * t);
};

/** 정점 하나의 뼈 가중치(최대 4개, 합 1). 살 두께로 나눈 거리가 가까운 뼈일수록 크다. */
export function skinWeightsAt(p: readonly [number, number, number], candidates: readonly { index: number; def: BoneDef }[]): { index: number[]; weight: number[] } {
  const scored: [number, number][] = [];
  for (const { index, def } of candidates) {
    if (def.side !== 0 && def.side * p[0] < -0.002) continue;
    const d = pointSegment(p, def.head, def.tail) / def.radius;
    scored.push([index, Math.max(d, 0.25) ** -6]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const top = scored.slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
  const index = [0, 0, 0, 0];
  const weight = [0, 0, 0, 0];
  top.forEach(([i, w], k) => {
    index[k] = i;
    weight[k] = w / sum;
  });
  return { index, weight };
}

function mirrorName(n: BoneName): BoneName {
  return (n.endsWith("L") ? `${n.slice(0, -1)}R` : n) as BoneName;
}

/** 다른 부위 속에 완전히 파묻힌 점인가. 옷 안쪽 단면처럼 보이지 않는 삼각형을 버리는 데 쓴다. */
function buriedIn(others: readonly Part[], x: number, y: number, z: number): boolean {
  for (const o of others) {
    const { min, max } = o.bounds;
    if (x < min[0] || y < min[1] || z < min[2] || x > max[0] || y > max[1] || z > max[2]) continue;
    if (o.sdf(x, y, z) < -0.004) return true;
  }
  return false;
}

function buildPart(part: Part, others: readonly Part[], defs: BoneDef[], out: Built) {
  const raw = surfaceNets(part.sdf, part.bounds, part.cell);
  const count = raw.positions.length / 3;
  const e = part.cell * 0.55;
  const local: { p: [number, number, number]; n: [number, number, number]; c: [number, number, number] }[] = [];
  for (let i = 0; i < count; i++) {
    let x = raw.positions[i * 3]!;
    let y = raw.positions[i * 3 + 1]!;
    let z = raw.positions[i * 3 + 2]!;
    // 격자에 묶인 점을 실제 표면으로 끌어당겨 계단 현상을 줄인다
    const g0 = gradient(part.sdf, x, y, z, e);
    const d0 = part.sdf(x, y, z);
    x -= g0[0] * d0;
    y -= g0[1] * d0;
    z -= g0[2] * d0;
    const n = gradient(part.sdf, x, y, z, e);
    const ao = part.flat ? 1 : occlusion(part.sdf, x, y, z, n);
    const paint = part.paint?.(x, y, z) ?? [1, 1, 1];
    local.push({ p: [x, y, z], n, c: [paint[0] * ao, paint[1] * ao, paint[2] * ao] });
  }

  const visible: boolean[] = [];
  for (let i = 0; i < raw.indices.length; i += 3) {
    const a = local[raw.indices[i]!]!.p;
    const b = local[raw.indices[i + 1]!]!.p;
    const c = local[raw.indices[i + 2]!]!.p;
    visible.push(!buriedIn(others, (a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3));
  }

  const emit = (mirror: boolean) => {
    const base = out.positions.length / 3;
    const names = mirror ? part.bones.map(mirrorName) : part.bones;
    const candidates = names.map((name) => ({ index: defs.findIndex((d) => d.name === name), def: defs.find((d) => d.name === name)! }));
    for (const v of local) {
      const p: [number, number, number] = mirror ? [-v.p[0], v.p[1], v.p[2]] : v.p;
      out.positions.push(...p);
      out.normals.push(mirror ? -v.n[0] : v.n[0], v.n[1], v.n[2]);
      out.colors.push(...v.c);
      const w = skinWeightsAt(p, candidates);
      out.skinIndex.push(...w.index);
      out.skinWeight.push(...w.weight);
    }
    for (let i = 0; i < raw.indices.length; i += 3) {
      if (!visible[i / 3]) continue;
      const a = raw.indices[i]! + base;
      const b = raw.indices[i + 1]! + base;
      const c = raw.indices[i + 2]! + base;
      if (mirror) out.indices.push(a, c, b);
      else out.indices.push(a, b, c);
    }
  };
  emit(false);
  if (part.mirror) emit(true);
}

/** 겉모습 → 메시. 부위별로 만들어 재질 칸(SLOTS) 순서대로 한 기하에 합친다. */
export function buildHumanAsset(a: ResolvedAppearance): HumanAsset {
  const parts = humanParts(a);
  const bones = boneDefs(a.body);
  const out: Built = { positions: [], normals: [], colors: [], indices: [], skinIndex: [], skinWeight: [] };
  const geometry = new THREE.BufferGeometry();
  const perPart: Record<string, number> = {};
  for (let slot = 0; slot < SLOTS.length; slot++) {
    const start = out.indices.length;
    for (const part of parts) {
      if (part.slot !== (SLOTS[slot] as Slot)) continue;
      const before = out.indices.length;
      buildPart(part, parts.filter((p) => p !== part), bones, out);
      perPart[part.name] = (out.indices.length - before) / 3;
    }
    geometry.addGroup(start, out.indices.length - start, slot);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(out.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(out.normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(out.colors, 3));
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(out.skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(out.skinWeight, 4));
  geometry.setIndex(out.indices);

  // 왼쪽 가슴 앞 표면 찾기
  const shirt = parts.find((p) => p.name === "shirt")!;
  let z = -0.1;
  const mx = 0.052;
  const my = 0.752;
  for (let i = 0; i < 80 && shirt.sdf(mx, my, z) > 0.0002; i++) z += Math.max(0.0005, shirt.sdf(mx, my, z));
  return { geometry, bones, triangles: out.indices.length / 3, perPart, chestMark: [mx, my, z] };
}

/** 메시는 체형·머리 모양마다 한 번만 만들고 같은 인물끼리 나눠 쓴다. 색은 재질에서 따로 입힌다. */
const cache = new Map<string, HumanAsset>();

export function humanAsset(a: ResolvedAppearance): HumanAsset {
  const key = JSON.stringify([a.body, a.face.jaw, a.hair.style, a.top.style, a.top.sleeve, a.bottom.style]);
  let asset = cache.get(key);
  if (!asset) {
    asset = buildHumanAsset(a);
    cache.set(key, asset);
  }
  return asset;
}

