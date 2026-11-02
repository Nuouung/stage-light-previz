import * as THREE from "three";
import { resolveAppearance, type Appearance, type ResolvedAppearance } from "../../model/appearance";
import { humanAsset } from "./human/asset";
import { SLOTS, type Slot } from "./human/parts";
import { POSES, type BoneName, type PoseDef, type PoseName } from "./human/rig";

/**
 * 무대 위 사람 한 명. 발바닥 중심이 원점이고 얼굴은 -Z(객석) 방향.
 * 메시와 재질은 인물끼리 나눠 쓰므로 렌더러가 지우면 안 된다(userData.shared).
 */
const SURFACE: Record<Slot, { roughness: number; color(a: ResolvedAppearance): string }> = {
  skin: { roughness: 0.62, color: (a) => a.face.skin },
  top: { roughness: 0.82, color: (a) => a.top.color },
  bottom: { roughness: 0.78, color: (a) => a.bottom.color },
  shoes: { roughness: 0.42, color: (a) => a.shoes.color },
  hair: { roughness: 0.78, color: (a) => a.hair.color },
};

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

function material(color: string, roughness: number, vertexColors = true): THREE.MeshStandardMaterial {
  const key = `${color}/${roughness}/${vertexColors}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, vertexColors });
    materialCache.set(key, m);
  }
  return m;
}

const markGeometry = new THREE.SphereGeometry(0.0072, 14, 10);
markGeometry.scale(1, 1, 0.3);

/** 뼈에 자세를 입힌다. 바인드 자세에서 얼마나 돌렸는지만 적으면 된다. */
export function applyPose(bones: Map<BoneName, THREE.Bone>, restHipY: number, pose: PoseDef): void {
  for (const [name, bone] of bones) {
    const r = pose.bones[name];
    // 굽힌(x) 다음에 안팎으로 돌리는(y) 순서
    bone.rotation.order = "YXZ";
    if (r) bone.rotation.set((r[0] * Math.PI) / 180, (r[1] * Math.PI) / 180, (r[2] * Math.PI) / 180);
    else bone.rotation.set(0, 0, 0);
  }
  const root = bones.get("root")!;
  root.position.set(0, pose.hipHeight === undefined ? 0 : pose.hipHeight - restHipY, pose.rootZ ?? 0);
}

export function buildFigure(height: number, pose: PoseName, color: string, appearance?: Appearance): THREE.Group {
  const look = resolveAppearance(appearance);
  const asset = humanAsset(look);
  const materials = SLOTS.map((slot) => material(SURFACE[slot].color(look), SURFACE[slot].roughness));
  const mesh = new THREE.SkinnedMesh(asset.geometry, materials);
  mesh.userData.shared = true;
  // 뼈 자세로 몸이 움직여 원래 범위를 벗어나므로 잘라내기 판정을 쓰지 않는다
  mesh.frustumCulled = false;

  const bones = new Map<BoneName, THREE.Bone>();
  const ordered: THREE.Bone[] = [];
  for (const def of asset.bones) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    const parent = def.parent ? asset.bones.find((b) => b.name === def.parent)! : null;
    bone.position.set(
      def.head[0] - (parent?.head[0] ?? 0),
      def.head[1] - (parent?.head[1] ?? 0),
      def.head[2] - (parent?.head[2] ?? 0),
    );
    if (def.parent) bones.get(def.parent)!.add(bone);
    bones.set(def.name, bone);
    ordered.push(bone);
  }
  const root = bones.get("root")!;
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(ordered), new THREE.Matrix4());

  // 인물 식별 표시: 가슴에 붙는 작은 배지
  const chest = asset.bones.find((b) => b.name === "chest")!;
  const mark = new THREE.Mesh(markGeometry, material(color, 0.5, false));
  mark.userData.shared = true;
  mark.position.set(asset.chestMark[0] - chest.head[0], asset.chestMark[1] - chest.head[1], asset.chestMark[2] - chest.head[2] - 0.001);
  bones.get("chest")!.add(mark);

  const hipCenter = asset.bones.find((b) => b.name === "hips")!.head[1];
  applyPose(bones, hipCenter, POSES[pose]);

  const group = new THREE.Group();
  group.add(mesh);
  group.scale.setScalar(height);
  group.userData.bones = bones;
  return group;
}
