import * as THREE from "three";

/**
 * 자세. 뼈마다 "똑바로 서서 팔을 벌린 기본 자세에서 몸 전체 기준으로 얼마나 돌렸는지"를 도(x, y, z)로 적는다.
 * 부모 뼈와 상관없이 몸 기준이라, 모형마다 뼈의 축이 달라도 같은 값으로 같은 자세가 나온다.
 * 몸 기준 축: 얼굴은 -z, 왼쪽은 -x, 위는 +y. x 회전 +는 아래로 뻗은 부위를 앞으로 든다.
 * 적지 않은 뼈는 기본 자세의 방향을 유지한다.
 */
export type PoseDef = Partial<Record<BoneName, readonly [number, number, number]>>;

/** 부모가 먼저 오도록 적는다. */
const BONES = [
  "Hips", "Spine", "Spine1", "Spine2", "Neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
  "RightShoulder", "RightArm", "RightForeArm", "RightHand",
  "LeftUpLeg", "LeftLeg", "LeftFoot",
  "RightUpLeg", "RightLeg", "RightFoot",
] as const;
export type BoneName = (typeof BONES)[number];
export const REQUIRED_BONES: readonly string[] = BONES;

const ARM_DOWN = 78;

/** 자세 표. 바닥에 앉기·무릎 꿇기 같은 자세는 이 표에 한 줄을 더하면 된다. */
export const POSES = {
  stand: {
    LeftArm: [2, 0, ARM_DOWN],
    LeftForeArm: [12, 0, ARM_DOWN],
    LeftHand: [12, 0, ARM_DOWN],
    RightArm: [2, 0, -ARM_DOWN],
    RightForeArm: [12, 0, -ARM_DOWN],
    RightHand: [12, 0, -ARM_DOWN],
  },
  sit: {
    LeftArm: [20, 0, ARM_DOWN],
    LeftForeArm: [62, -28, ARM_DOWN],
    LeftHand: [62, -28, ARM_DOWN],
    RightArm: [20, 0, -ARM_DOWN],
    RightForeArm: [62, 28, -ARM_DOWN],
    RightHand: [62, 28, -ARM_DOWN],
    LeftUpLeg: [90, 0, 0],
    RightUpLeg: [90, 0, 0],
  },
} satisfies Record<string, PoseDef>;
export type PoseName = keyof typeof POSES;

const DEG = Math.PI / 180;
const footHeight = (model: THREE.Object3D) => {
  const left = model.getObjectByName("LeftFoot");
  const right = model.getObjectByName("RightFoot");
  const y = (o?: THREE.Object3D) => (o ? o.getWorldPosition(new THREE.Vector3()).y : Infinity);
  return Math.min(y(left), y(right));
};

/**
 * 모형에 자세를 입히고, 발이 원래 높이(바닥)에 오도록 모형을 위아래로 옮긴다.
 * 기본 자세의 모형에 한 번만 호출한다.
 */
export function applyPose(model: THREE.Object3D, pose: PoseDef): void {
  model.updateMatrixWorld(true);
  const restFoot = footHeight(model);
  const bones = BONES.map((name) => model.getObjectByName(name)).filter((b) => !!b);
  const rest = bones.map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
  const turn = new THREE.Quaternion();
  const parentWorld = new THREE.Quaternion();
  bones.forEach((bone, i) => {
    const r = pose[bone.name as BoneName] ?? [0, 0, 0];
    turn.setFromEuler(new THREE.Euler(r[0] * DEG, r[1] * DEG, r[2] * DEG, "XYZ"));
    bone.parent!.getWorldQuaternion(parentWorld);
    bone.quaternion.copy(parentWorld.invert().multiply(turn).multiply(rest[i]!));
    bone.updateMatrixWorld(true);
  });
  model.position.y += restFoot - footHeight(model);
  model.updateMatrixWorld(true);
}
