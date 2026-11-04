import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyPose, POSES } from "../src/view/stage3d/pose";

/** 뼈 축이 제각각인 작은 사람. 팔을 벌리고 서 있고 얼굴은 -z, 왼쪽은 -x. */
function tinyBody() {
  const root = new THREE.Group();
  const bone = (name: string, parent: THREE.Object3D, world: [number, number, number], twist = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    parent.updateWorldMatrix(true, false);
    b.position.copy(parent.worldToLocal(new THREE.Vector3(...world)));
    b.rotation.set(twist, twist * 0.5, -twist);
    parent.add(b);
    b.updateWorldMatrix(true, false);
    return b;
  };
  const hips = bone("Hips", root, [0, 0.9, 0], 0.4);
  const spine = bone("Spine", hips, [0, 1.1, 0], 0.7);
  const armL = bone("LeftArm", spine, [-0.2, 1.4, 0], 1.1);
  const foreL = bone("LeftForeArm", armL, [-0.5, 1.4, 0], -0.6);
  bone("LeftHand", foreL, [-0.75, 1.4, 0], 0.3);
  const armR = bone("RightArm", spine, [0.2, 1.4, 0], -0.9);
  const foreR = bone("RightForeArm", armR, [0.5, 1.4, 0], 0.2);
  bone("RightHand", foreR, [0.75, 1.4, 0], 0.8);
  for (const [side, x] of [["Left", -0.1], ["Right", 0.1]] as const) {
    const thigh = bone(`${side}UpLeg`, hips, [x, 0.9, 0], 0.5);
    const shin = bone(`${side}Leg`, thigh, [x, 0.5, 0], -1);
    bone(`${side}Foot`, shin, [x, 0.1, 0], 1.3);
  }
  root.updateMatrixWorld(true);
  return root;
}
const at = (root: THREE.Object3D, name: string) => root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());

describe("자세", () => {
  it("서면 손이 어깨보다 아래로 내려온다", () => {
    const body = tinyBody();
    applyPose(body, POSES.stand);
    expect(at(body, "LeftHand").y).toBeLessThan(at(body, "LeftArm").y - 0.3);
    expect(at(body, "RightHand").y).toBeLessThan(at(body, "RightArm").y - 0.3);
  });

  it("왼팔은 왼쪽(-x), 오른팔은 오른쪽(+x)에 남는다", () => {
    const body = tinyBody();
    applyPose(body, POSES.stand);
    expect(at(body, "LeftHand").x).toBeLessThan(0);
    expect(at(body, "RightHand").x).toBeGreaterThan(0);
  });

  it("서면 발은 그대로 바닥 높이에 있다", () => {
    const body = tinyBody();
    applyPose(body, POSES.stand);
    expect(at(body, "LeftFoot").y).toBeCloseTo(0.1);
  });

  it("앉으면 무릎이 얼굴 쪽(-z)으로 나오고 엉덩이가 내려간다", () => {
    const body = tinyBody();
    applyPose(body, POSES.sit);
    expect(at(body, "LeftLeg").z).toBeLessThan(-0.3);
    expect(at(body, "Hips").y).toBeLessThan(0.6);
  });

  it("앉아도 발은 바닥 높이에 있다", () => {
    const body = tinyBody();
    applyPose(body, POSES.sit);
    expect(at(body, "LeftFoot").y).toBeCloseTo(0.1);
    expect(at(body, "RightFoot").y).toBeCloseTo(0.1);
  });
});
