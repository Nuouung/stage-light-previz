import type { ResolvedAppearance } from "../../../model/appearance";
import type { P3 } from "./sdf";

/**
 * 공통 리그. 7명이 모두 같은 뼈 구조를 쓰고, 체형은 관절 위치로만 달라진다.
 * 치수는 키를 1로 본 비율(Drillis & Contini의 인체 비율표 기준). 얼굴은 -z(객석) 방향.
 * 바인드 자세는 팔을 살짝 벌린 자세: 팔과 몸통이 붙지 않아야 메시가 깔끔하게 나온다.
 */
export const REST_ARM_DEG = 24;

export type BoneName =
  | "root" | "hips" | "spine" | "chest" | "neck" | "head"
  | "upperArmL" | "forearmL" | "handL" | "upperArmR" | "forearmR" | "handR"
  | "thighL" | "shinL" | "footL" | "thighR" | "shinR" | "footR";

export type BoneDef = {
  name: BoneName;
  parent: BoneName | null;
  /** 관절 위치 */
  head: P3;
  /** 뼈 끝. 피부 가중치 계산에 쓴다 */
  tail: P3;
  /** 이 뼈가 감싸는 살 두께 */
  radius: number;
  /** +1 = +x 쪽, -1 = -x 쪽, 0 = 가운데 */
  side: 1 | -1 | 0;
};

export type Landmarks = {
  hipCenter: P3; waist: P3; chest: P3; neckBase: P3; skullBase: P3; crown: P3;
  shoulder(s: number): P3; elbow(s: number): P3; wrist(s: number): P3; fingertip(s: number): P3;
  hip(s: number): P3; knee(s: number): P3; ankle(s: number): P3; toe(s: number): P3;
};

const UPPER_ARM = 0.186;
const FOREARM = 0.145;
const HAND = 0.108;

export function landmarks(body: ResolvedAppearance["body"]): Landmarks {
  const a = (REST_ARM_DEG * Math.PI) / 180;
  const shoulderX = 0.1 * body.shoulders;
  const shoulderY = 0.806;
  const alongArm = (s: number, d: number): P3 => [s * (shoulderX + Math.sin(a) * d), shoulderY - Math.cos(a) * d, 0];
  const hipX = 0.048 * body.hips;
  return {
    hipCenter: [0, 0.53, 0],
    waist: [0, 0.615, 0],
    chest: [0, 0.72, 0],
    neckBase: [0, 0.825, 0.006],
    skullBase: [0, 0.88, 0.006],
    crown: [0, 1, 0.004],
    shoulder: (s) => alongArm(s, 0),
    elbow: (s) => alongArm(s, UPPER_ARM),
    wrist: (s) => alongArm(s, UPPER_ARM + FOREARM),
    fingertip: (s) => alongArm(s, UPPER_ARM + FOREARM + HAND),
    hip: (s) => [s * hipX, 0.525, 0],
    knee: (s) => [s * (hipX + 0.002), 0.285, -0.003],
    ankle: (s) => [s * (hipX + 0.005), 0.042, 0.012],
    toe: (s) => [s * (hipX + 0.016), 0.015, -0.1],
  };
}

export function boneDefs(body: ResolvedAppearance["body"]): BoneDef[] {
  const l = landmarks(body);
  const g = body.girth;
  const defs: BoneDef[] = [
    { name: "root", parent: null, head: [0, 0, 0], tail: [0, 0, 0], radius: 0.0001, side: 0 },
    { name: "hips", parent: "root", head: l.hipCenter, tail: l.waist, radius: 0.09, side: 0 },
    { name: "spine", parent: "hips", head: l.waist, tail: l.chest, radius: 0.085, side: 0 },
    { name: "chest", parent: "spine", head: l.chest, tail: l.neckBase, radius: 0.1, side: 0 },
    { name: "neck", parent: "chest", head: l.neckBase, tail: l.skullBase, radius: 0.034, side: 0 },
    { name: "head", parent: "neck", head: l.skullBase, tail: l.crown, radius: 0.055, side: 0 },
  ];
  for (const [s, n] of [[1, "L"], [-1, "R"]] as const) {
    defs.push(
      { name: `upperArm${n}`, parent: "chest", head: l.shoulder(s), tail: l.elbow(s), radius: 0.03 * g, side: s },
      { name: `forearm${n}`, parent: `upperArm${n}`, head: l.elbow(s), tail: l.wrist(s), radius: 0.024 * g, side: s },
      { name: `hand${n}`, parent: `forearm${n}`, head: l.wrist(s), tail: l.fingertip(s), radius: 0.03, side: s },
      { name: `thigh${n}`, parent: "hips", head: l.hip(s), tail: l.knee(s), radius: 0.05 * g, side: s },
      { name: `shin${n}`, parent: `thigh${n}`, head: l.knee(s), tail: l.ankle(s), radius: 0.036 * g, side: s },
      { name: `foot${n}`, parent: `shin${n}`, head: l.ankle(s), tail: l.toe(s), radius: 0.035, side: s },
    );
  }
  return defs;
}

/** 자세 = 뼈별 회전(도, 부모 기준 x·y·z)과 전체 위치 이동. */
export type PoseDef = {
  bones: Partial<Record<BoneName, readonly [number, number, number]>>;
  /** 엉덩이 관절을 옮긴 높이(키 대비). 없으면 그대로 */
  hipHeight?: number;
  /** 몸 전체를 앞뒤로 옮기는 값(키 대비) */
  rootZ?: number;
};

const armDown = 24 - 4.5;

/**
 * 자세 표. x 회전 +는 앞으로 굽힘(팔·허벅지), 정강이는 -가 무릎 굽힘.
 * 바닥에 앉기·무릎 꿇기 같은 자세는 이 표에 한 줄을 더하면 된다.
 */
export const POSES = {
  stand: {
    bones: {
      head: [-2, 2, 0],
      upperArmL: [3, 0, -armDown],
      forearmL: [14, 0, 0],
      handL: [6, 0, 0],
      upperArmR: [2, 0, armDown + 1],
      forearmR: [10, 0, 0],
      handR: [4, 0, 0],
    },
  },
  sit: {
    hipHeight: 0.315,
    bones: {
      spine: [-2, 0, 0],
      head: [-2, 0, 0],
      upperArmL: [16, 0, -armDown],
      forearmL: [50, 28, 0],
      handL: [8, 0, 0],
      upperArmR: [16, 0, armDown],
      forearmR: [50, -28, 0],
      handR: [8, 0, 0],
      thighL: [83, 0, -1],
      shinL: [-83, 0, 1],
      thighR: [83, 0, 1],
      shinR: [-83, 0, -1],
    },
  },
} satisfies Record<string, PoseDef>;

export type PoseName = keyof typeof POSES;
