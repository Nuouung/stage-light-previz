import type { ResolvedAppearance } from "../../../model/appearance";
import { REST_ARM_DEG, landmarks, type BoneName } from "./rig";
import { cone, ellipsoid, smax, smin, type P3, type Sdf } from "./sdf";
import type { Bounds } from "./surfaceNets";

/**
 * 인체 형태. 키를 1로 본 좌표, 얼굴은 -z.
 * 사람 몸 전체를 하나로 만들고 옷을 입히는 대신, 겉으로 보이는 층(피부·셔츠·바지·신발·머리)만 표면으로 만든다.
 * 몸통은 높이별 단면(폭·깊이)을 적은 표에서 나오고, 팔다리는 그 표면에 녹아 붙는다.
 */
export type Slot = "skin" | "top" | "bottom" | "shoes" | "hair";
export const SLOTS: readonly Slot[] = ["skin", "top", "bottom", "shoes", "hair"];

export type Part = {
  name: string;
  slot: Slot;
  sdf: Sdf;
  bounds: Bounds;
  /** 격자 크기. 작을수록 정밀하고 무겁다 */
  cell: number;
  /** 이 부위를 움직일 수 있는 뼈 */
  bones: readonly BoneName[];
  /** +x 쪽만 만들고 -x 쪽으로 복제 */
  mirror?: boolean;
  /** 주변 차폐를 입히지 않는다. 손가락처럼 작은 부위는 끝이 얼룩져 보인다 */
  flat?: boolean;
  /** 정점 색 배율(얼굴 음영, 신발 밑창 등). 질감 이미지 없이 구분을 준다 */
  paint?: (x: number, y: number, z: number) => [number, number, number];
};

/** 높이별 몸통 단면: [y, 반폭, 반깊이, 앞뒤 중심] */
type Section = readonly [number, number, number, number];

function loft(sections: readonly Section[], scaleAt: (y: number) => [number, number]): Sdf {
  const yMin = sections[0]![0];
  const yMax = sections[sections.length - 1]![0];
  const N = 160;
  const w = new Float64Array(N + 1);
  const d = new Float64Array(N + 1);
  const c = new Float64Array(N + 1);
  const catmull = (a: number, b: number, e: number, f: number, t: number) =>
    0.5 * (2 * b + (e - a) * t + (2 * a - 5 * b + 4 * e - f) * t * t + (3 * b - a - 3 * e + f) * t * t * t);
  for (let i = 0; i <= N; i++) {
    const y = yMin + ((yMax - yMin) * i) / N;
    let s = 0;
    while (s < sections.length - 2 && y > sections[s + 1]![0]) s++;
    const p1 = sections[s]!;
    const p2 = sections[s + 1]!;
    const p0 = sections[Math.max(0, s - 1)]!;
    const p3 = sections[Math.min(sections.length - 1, s + 2)]!;
    const t = (y - p1[0]) / (p2[0] - p1[0]);
    const [sw, sd] = scaleAt(y);
    w[i] = catmull(p0[1], p1[1], p2[1], p3[1], t) * sw;
    d[i] = catmull(p0[2], p1[2], p2[2], p3[2], t) * sd;
    c[i] = catmull(p0[3], p1[3], p2[3], p3[3], t);
  }
  return (x, y, z) => {
    const u = Math.min(N, Math.max(0, ((y - yMin) / (yMax - yMin)) * N));
    const i = Math.min(N - 1, Math.floor(u));
    const t = u - i;
    const rw = w[i]! + (w[i + 1]! - w[i]!) * t;
    const rd = d[i]! + (d[i + 1]! - d[i]!) * t;
    const pz = z - (c[i]! + (c[i + 1]! - c[i]!) * t);
    const k0 = Math.hypot(x / rw, pz / rd);
    const k1 = Math.hypot(x / (rw * rw), pz / (rd * rd)) || 1e-6;
    const side = (k0 * (k0 - 1)) / k1;
    return Math.max(side, yMin - y, y - yMax);
  };
}

const SHIRT_SECTIONS: readonly Section[] = [
  [0.57, 0.083, 0.06, 0.002],
  [0.615, 0.08, 0.056, 0],
  [0.665, 0.083, 0.057, -0.002],
  [0.72, 0.09, 0.064, -0.005],
  [0.77, 0.091, 0.06, -0.002],
  [0.8, 0.08, 0.05, 0.004],
  [0.825, 0.058, 0.043, 0.008],
  [0.842, 0.042, 0.038, 0.012],
  [0.856, 0.03, 0.032, 0.016],
];

const TROUSER_SECTIONS: readonly Section[] = [
  [0.462, 0.048, 0.04, 0.008],
  [0.495, 0.086, 0.06, 0.008],
  [0.53, 0.098, 0.068, 0.012],
  [0.565, 0.094, 0.066, 0.008],
  [0.6, 0.085, 0.061, 0.003],
  [0.622, 0.083, 0.06, 0.001],
];

const lerpTable = (table: readonly (readonly [number, number])[], v: number): number => {
  if (v <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!;
    const [x0, y0] = table[i - 1]!;
    if (v <= x1) return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0);
  }
  return table[table.length - 1]![1];
};

const gauss = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));

/** 머리뼈. 머리카락이 이 표면을 기준으로 얹힌다. */
function skull(a: ResolvedAppearance): { cranium: Sdf; head: Sdf } {
  const jaw = a.face.jaw;
  const cranium = ellipsoid([0, 0.944, 0.006], [0.0435, 0.052, 0.054]);
  const jawBone = ellipsoid([0, 0.909, -0.01], [0.0392 * jaw, 0.04, 0.041]);
  const chin = ellipsoid([0, 0.877, -0.033], [0.0145 * jaw, 0.0105, 0.0125]);
  const cheekbone = ellipsoid([0.0295, 0.922, -0.027], [0.0115, 0.012, 0.0145]);
  const brow = ellipsoid([0.0145, 0.9445, -0.0425], [0.0155, 0.0046, 0.0066]);
  const nose = cone([0, 0.934, -0.0485], [0, 0.912, -0.0565], 0.0032, 0.0044);
  const noseTip = ellipsoid([0, 0.9085, -0.0545], [0.0078, 0.0056, 0.0066]);
  const lips = ellipsoid([0, 0.8895, -0.0455], [0.0125, 0.0038, 0.0045]);
  const socket = ellipsoid([0.0185, 0.9315, -0.054], [0.0105, 0.006, 0.008]);
  const ear = ellipsoid([0.0455, 0.924, 0.006], [0.0042, 0.0145, 0.0088]);
  const head: Sdf = (px, y, z) => {
    const x = Math.abs(px);
    let d = smin(cranium(x, y, z), jawBone(x, y, z), 0.02);
    d = smin(d, chin(x, y, z), 0.014);
    d = smin(d, cheekbone(x, y, z), 0.014);
    d = smin(d, brow(x, y, z), 0.016);
    d = smax(d, -socket(x, y, z), 0.011);
    d = smin(d, smin(nose(x, y, z), noseTip(x, y, z), 0.006), 0.008);
    d = smin(d, lips(x, y, z), 0.006);
    d = smin(d, ear(x, y, z), 0.005);
    return d;
  };
  return { cranium, head };
}

function hairPart(a: ResolvedAppearance): Part {
  const { cranium } = skull(a);
  // 왼쪽 가르마 쪽으로 볼륨을 얹는다
  const top = ellipsoid([-0.005, 0.966, -0.006], [0.044, 0.0375, 0.0525]);
  // 머리선 높이: 정면(0)에서 귀 위(π/2)를 거쳐 뒤통수(π)까지
  const line: readonly (readonly [number, number])[] = [
    [0, 0.9635], [0.45, 0.9625], [0.78, 0.953], [1.02, 0.936], [1.3, 0.928], [1.62, 0.936], [1.95, 0.922], [2.45, 0.9], [Math.PI, 0.887],
  ];
  const sdf: Sdf = (x, y, z) => {
    let d = smin(cranium(x, y, z) - 0.0046, top(x, y, z), 0.014);
    // 빗어 넘긴 굵은 머리결
    d += 0.0013 * Math.sin((x * 0.8 + z * 0.3) * 150 + y * 30) + 0.0008 * Math.sin((z - x * 0.4) * 240 + y * 60);
    const theta = Math.abs(Math.atan2(x, -(z - 0.006)));
    const edge = lerpTable(line, theta) + 0.0016 * Math.sin(theta * 17 + (x > 0 ? 0 : 1.4));
    return smax(d, edge - y, 0.003);
  };
  return {
    name: "hair", slot: "hair", sdf, cell: 0.0072, bones: ["head"],
    bounds: { min: [-0.065, 0.872, -0.07], max: [0.065, 1.015, 0.075] },
  };
}

function headPart(a: ResolvedAppearance): Part {
  const { head } = skull(a);
  const neck = cone([0, 0.895, 0.009], [0, 0.8, 0.007], 0.0295, 0.034);
  const sdf: Sdf = (x, y, z) => smin(head(x, y, z), neck(x, y, z), 0.012);
  const paint = (px: number, y: number, z: number): [number, number, number] => {
    if (z > -0.015 || y > 0.965 || y < 0.875) return [1, 1, 1];
    const x = Math.abs(px);
    const socketShade = gauss(x, y, 0.0185, 0.933, 0.0125, 0.0065) * 0.26;
    const lip = gauss(x, y, 0, 0.8895, 0.0125, 0.0036) * 0.24;
    const dark = socketShade;
    return [(1 - dark) * (1 - lip * 0.25), (1 - dark) * (1 - lip), (1 - dark) * (1 - lip)];
  };
  return {
    name: "head", slot: "skin", sdf, cell: 0.0052, paint, bones: ["chest", "neck", "head"],
    bounds: { min: [-0.065, 0.785, -0.08], max: [0.065, 1.005, 0.075] },
  };
}

/** 앞에서 표면에 닿을 때까지 -z 쪽에서 들어간 위치. */
function surfaceZ(f: Sdf, x: number, y: number): number {
  let z = -0.09;
  for (let i = 0; i < 60; i++) {
    const d = f(x, y, z);
    if (d < 0.0002) break;
    z += d;
  }
  return z;
}

/** 얼굴이 멀리서도 읽히게 하는 작은 표식: 눈동자·눈썹 (머리색으로 그림). */
function facePart(a: ResolvedAppearance): Part {
  const { head } = skull(a);
  const at = (x: number, y: number, lift: number): P3 => [x, y, surfaceZ(head, x, y) - lift];
  const iris = ellipsoid(at(0.0185, 0.9315, 0.0012), [0.0027, 0.0027, 0.0013]);
  const brow1 = cone(at(0.0078, 0.9402, 0), at(0.0185, 0.9425, 0), 0.0016, 0.0015);
  const brow2 = cone(at(0.0185, 0.9425, 0), at(0.0292, 0.9395, 0), 0.0015, 0.001);
  const sdf: Sdf = (px, y, z) => {
    const x = Math.abs(px);
    return Math.min(iris(x, y, z), brow1(x, y, z), brow2(x, y, z));
  };
  return {
    name: "face", slot: "hair", sdf, cell: 0.0014, flat: true, bones: ["head"],
    bounds: { min: [-0.036, 0.925, -0.06], max: [0.036, 0.948, -0.028] },
  };
}

/** 흰자와 입선. 피부 재질에 색 배율을 입혀 그린다. */
function faceSkinPart(a: ResolvedAppearance): Part {
  const { head } = skull(a);
  const at = (x: number, y: number, lift: number): P3 => [x, y, surfaceZ(head, x, y) - lift];
  const white = ellipsoid(at(0.0185, 0.9312, -0.0008), [0.0072, 0.0026, 0.0024]);
  const mouth = cone(at(0, 0.8892, 0), at(0.0118, 0.8898, 0), 0.0009, 0.0006);
  const sdf: Sdf = (px, y, z) => {
    const x = Math.abs(px);
    return Math.min(white(x, y, z), mouth(x, y, z));
  };
  return {
    name: "faceSkin", slot: "skin", sdf, cell: 0.0014, flat: true, bones: ["head"],
    bounds: { min: [-0.032, 0.885, -0.06], max: [0.032, 0.94, -0.03] },
    paint: (_x, y) => (y > 0.91 ? [1.5, 1.55, 1.6] : [0.42, 0.25, 0.25]),
  };
}

/** 팔의 축 위 거리로 소매 끝을 자르기 위한 준비. +x 쪽 기준. */
function armAxis(shoulder: P3) {
  const a = (REST_ARM_DEG * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  return (x: number, y: number) => (x - shoulder[0]) * dx + (y - shoulder[1]) * dy;
}

/** 어깨에서 소매 끝까지 거리. */
const sleeveEnd = (a: ResolvedAppearance) => (a.top.sleeve === "rolled" ? 0.186 + 0.145 * 0.42 : 0.186 + 0.145 * 0.965);

function shirtPart(a: ResolvedAppearance): Part {
  const body = a.body;
  const l = landmarks(body);
  const g = body.girth;
  const S = l.shoulder(1);
  const E = l.elbow(1);
  const W = l.wrist(1);
  // 목은 뚫지 않는다: 몸통 위쪽이 목보다 좁아지는 지점에서 목이 그대로 뚫고 나오며, 그 교차선이 곧 목둘레선이다
  const torso = loft(SHIRT_SECTIONS, (y) => {
    const waist = 1 - (1 - body.waist) * Math.max(0, 1 - Math.abs(y - 0.62) / 0.09);
    const shoulders = 1 + (body.shoulders - 1) * Math.min(1, Math.max(0, (y - 0.68) / 0.09));
    return [waist * shoulders * (1 + (g - 1) * 0.6), 1 + (g - 1) * 0.7];
  });
  const trap = cone([0.03, 0.838, 0.009], [S[0] - 0.006, S[1] + 0.001, 0.002], 0.0175, 0.0185);
  const delt = ellipsoid([S[0] + 0.002, S[1] - 0.024, 0], [0.0285 * g, 0.04, 0.032 * g]);
  const upper = cone(S, E, 0.0252 * g, 0.0226 * g);
  const rolled = a.top.sleeve === "rolled";
  const fore = cone(E, W, 0.0232 * g, rolled ? 0.0215 * g : 0.0195 * g);
  const along = armAxis(S);
  const end = sleeveEnd(a);
  const sdf: Sdf = (px, y, z) => {
    const x = Math.abs(px);
    // 팔: 끝을 자르고 몸통에 녹여 붙인다
    let arm = smin(upper(x, y, z), fore(x, y, z), 0.004);
    arm = smax(arm, along(x, y) - end, 0.004);
    let d = smin(torso(x, y, z), trap(x, y, z), 0.03);
    d = smin(d, delt(x, y, z), 0.024);
    d = smin(d, arm, 0.016);
    // 천의 잔주름: 허리와 팔꿈치 주변에 아주 얕게
    const waistFold = Math.max(0, 1 - Math.abs(y - 0.625) / 0.055);
    d += waistFold * 0.0012 * Math.sin(px * 70 + y * 55 + 1.2 * Math.sin(z * 50));
    return smax(d, 0.585 - y, 0.004);
  };
  return {
    name: "shirt", slot: "top", sdf, cell: 0.0135,
    bones: ["hips", "spine", "chest", "neck", "upperArmL", "forearmL", "upperArmR", "forearmR"],
    bounds: { min: [-W[0] - 0.05, W[1] - 0.04, -0.1], max: [W[0] + 0.05, 0.875, 0.09] },
  };
}

/** 걷어 올린 소매 끝. 잘린 천 가장자리를 덮는다. */
function cuffPart(a: ResolvedAppearance): Part {
  const l = landmarks(a.body);
  const E = l.elbow(1);
  const W = l.wrist(1);
  const g = a.body.girth;
  const t = (sleeveEnd(a) - 0.186) / 0.145;
  const point = (u: number): P3 => [E[0] + (W[0] - E[0]) * u, E[1] + (W[1] - E[1]) * u, 0];
  const c0 = point(t - 0.075);
  const c1 = point(t);
  const r = a.top.sleeve === "rolled" ? 0.0252 * g : 0.0222 * g;
  const sdf = cone(c0, c1, r, r);
  return {
    name: "cuff", slot: "top", sdf, cell: 0.0065, mirror: true, bones: ["forearmL"],
    bounds: { min: [c0[0] - 0.04, c1[1] - 0.04, -0.04], max: [c1[0] + 0.04, c0[1] + 0.04, 0.04] },
  };
}

function armSkinPart(a: ResolvedAppearance): Part {
  const l = landmarks(a.body);
  const g = a.body.girth;
  const E = l.elbow(1);
  const W = l.wrist(1);
  const point = (u: number): P3 => [E[0] + (W[0] - E[0]) * u, E[1] + (W[1] - E[1]) * u, 0];
  const start = point(a.top.sleeve === "rolled" ? 0.36 : 0.86);
  const upper = cone(start, point(0.62), 0.0212 * g, 0.0192 * g);
  const lower = cone(point(0.62), point(1.02), 0.0192 * g, 0.0155);
  const sdf: Sdf = (x, y, z) => Math.min(upper(x, y, z), lower(x, y, z));
  return {
    name: "forearm", slot: "skin", sdf, cell: 0.0095, mirror: true, bones: ["forearmL"],
    bounds: { min: [start[0] - 0.035, W[1] - 0.02, -0.035], max: [W[0] + 0.035, start[1] + 0.03, 0.035] },
  };
}

function handPart(a: ResolvedAppearance): Part {
  const l = landmarks(a.body);
  const W = l.wrist(1);
  const r = (REST_ARM_DEG * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  // 손 좌표: 손목이 원점, 손가락이 -y, 손바닥이 -x(몸 쪽), 엄지가 -z(앞)
  const palm = ellipsoid([0, -0.031, -0.001], [0.0105, 0.034, 0.0235]);
  const wrist = cone([0, 0.002, 0], [0, -0.016, 0], 0.0153, 0.016);
  const fingers: Sdf[] = [];
  const zs = [-0.0165, -0.0055, 0.0055, 0.0165];
  const lengths = [0.04, 0.045, 0.042, 0.033];
  const radii = [0.0047, 0.0049, 0.0046, 0.0041];
  for (let i = 0; i < 4; i++) {
    const z0 = zs[i]!;
    const len = lengths[i]!;
    const r0 = radii[i]!;
    const base: P3 = [-0.001, -0.058, z0];
    const mid: P3 = [-0.0035, -0.058 - len * 0.56, z0 * 1.14];
    const tip: P3 = [-0.0105, -0.058 - len * 0.98, z0 * 1.2];
    fingers.push(cone(base, mid, r0, r0 * 0.92), cone(mid, tip, r0 * 0.92, r0 * 0.78));
  }
  const thumbA = cone([-0.004, -0.012, -0.018], [-0.0085, -0.04, -0.0315], 0.0082, 0.006);
  const thumbB = cone([-0.0085, -0.04, -0.0315], [-0.013, -0.0605, -0.0365], 0.006, 0.0048);
  const sdf: Sdf = (x, y, z) => {
    const rx = x - W[0];
    const ry = y - W[1];
    const lx = rx * cos + ry * sin;
    const ly = -rx * sin + ry * cos;
    const lz = z - W[2];
    let d = smin(palm(lx, ly, lz), wrist(lx, ly, lz), 0.008);
    let f = Infinity;
    for (const finger of fingers) f = Math.min(f, finger(lx, ly, lz));
    d = smin(d, f, 0.004);
    d = smin(d, thumbA(lx, ly, lz), 0.009);
    d = smin(d, thumbB(lx, ly, lz), 0.003);
    return d;
  };
  const tip = l.fingertip(1);
  return {
    name: "hand", slot: "skin", sdf, cell: 0.0052, mirror: true, flat: true, bones: ["forearmL", "handL"],
    bounds: { min: [W[0] - 0.03, tip[1] - 0.02, -0.05], max: [tip[0] + 0.03, W[1] + 0.02, 0.035] },
  };
}

function trouserPart(a: ResolvedAppearance): Part {
  const body = a.body;
  const l = landmarks(body);
  const g = body.girth;
  const H = l.hip(1);
  const K = l.knee(1);
  const A = l.ankle(1);
  const hem: P3 = [A[0], 0.03, A[2] - 0.002];
  const hips = loft(TROUSER_SECTIONS, (y) => {
    const waist = 1 - (1 - body.waist) * Math.min(1, Math.max(0, (y - 0.54) / 0.06));
    const hip = 1 + (body.hips - 1) * Math.max(0, 1 - Math.abs(y - 0.53) / 0.08);
    return [waist * hip * (1 + (g - 1) * 0.6), 1 + (g - 1) * 0.7];
  });
  const thigh = cone([H[0], H[1] + 0.01, H[2]], K, 0.0465 * g, 0.0335 * g);
  const shin = cone(K, hem, 0.0332 * g, 0.0285 * g);
  const sdf: Sdf = (px, y, z) => {
    const x = Math.abs(px);
    const leg = smin(thigh(x, y, z), shin(x, y, z), 0.004);
    let d = smin(hips(x, y, z), leg, 0.022);
    d = smax(d, 0.03 - y, 0.004);
    return smax(d, y - 0.617, 0.004);
  };
  return {
    name: "trousers", slot: "bottom", sdf, cell: 0.0135,
    bones: ["hips", "spine", "thighL", "shinL", "footL", "thighR", "shinR", "footR"],
    bounds: { min: [-0.135 * body.hips, 0.015, -0.1], max: [0.135 * body.hips, 0.64, 0.1] },
  };
}

function beltPart(a: ResolvedAppearance): Part {
  const body = a.body;
  const hips = loft(TROUSER_SECTIONS, (y) => {
    const waist = 1 - (1 - body.waist) * Math.min(1, Math.max(0, (y - 0.54) / 0.06));
    return [waist * (1 + (body.girth - 1) * 0.6), 1 + (body.girth - 1) * 0.7];
  });
  const sdf: Sdf = (x, y, z) => smax(smax(hips(x, y, z) - 0.0034, 0.6 - y, 0.0012), y - 0.619, 0.0012);
  return {
    name: "belt", slot: "shoes", sdf, cell: 0.0075, bones: ["hips", "spine"],
    bounds: { min: [-0.105, 0.59, -0.085], max: [0.105, 0.628, 0.085] },
  };
}

function shoePart(a: ResolvedAppearance): Part {
  const A = landmarks(a.body).ankle(1);
  const toeOut = (5 * Math.PI) / 180;
  const cos = Math.cos(toeOut);
  const sin = Math.sin(toeOut);
  const heel = ellipsoid([0, 0.026, 0.02], [0.0255, 0.028, 0.033]);
  const ball = ellipsoid([0, 0.021, -0.03], [0.0285, 0.022, 0.05]);
  const toe = ellipsoid([0, 0.013, -0.07], [0.0255, 0.0135, 0.036]);
  const collar = cone([0, 0.03, 0.004], [0, 0.058, 0.002], 0.0245, 0.024);
  const sdf: Sdf = (x, y, z) => {
    const rx = x - A[0];
    const rz = z - A[2];
    const lx = rx * cos + rz * sin;
    const lz = -rx * sin + rz * cos;
    let d = smin(heel(lx, y, lz), ball(lx, y, lz), 0.024);
    d = smin(d, toe(lx, y, lz), 0.018);
    d = smin(d, collar(lx, y, lz), 0.02);
    return Math.max(d, -y);
  };
  return {
    name: "shoe", slot: "shoes", sdf, cell: 0.0092, mirror: true, bones: ["shinL", "footL"],
    bounds: { min: [A[0] - 0.05, -0.012, A[2] - 0.135], max: [A[0] + 0.065, 0.085, A[2] + 0.075] },
    paint: (_x, y) => (y < 0.009 ? [0.45, 0.45, 0.45] : [1, 1, 1]),
  };
}

export function humanParts(a: ResolvedAppearance): Part[] {
  return [headPart(a), facePart(a), faceSkinPart(a), hairPart(a), shirtPart(a), cuffPart(a), armSkinPart(a), handPart(a), trouserPart(a), beltPart(a), shoePart(a)];
}
