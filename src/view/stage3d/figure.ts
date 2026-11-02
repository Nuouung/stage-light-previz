import * as THREE from "three";

/**
 * 무대 블로킹용 중립 마네킹.
 * 원점은 발바닥 중심, 얼굴은 -z(객석) 방향.
 * 얼굴·의상 디테일보다 신체 비율과 몸의 방향이 읽히는 데 집중한다.
 */

function capsule(
  radius: number,
  from: THREE.Vector3,
  to: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(length - 2 * radius, 0.001), 5, 12),
    material,
  );
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function joint(radius: number, at: THREE.Vector3, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), material);
  mesh.position.copy(at);
  return mesh;
}

export function buildFigure(h: number, pose: "stand" | "sit", color: string): THREE.Group {
  const group = new THREE.Group();
  const scale = (x: number, y: number, z: number) => new THREE.Vector3(x * h, y * h, z * h);

  // 인물별 색은 식별용 포인트로만 쓰고, 몸 전체는 무대에서 튀지 않는 중립색으로 둔다.
  const skin = new THREE.MeshStandardMaterial({ color: "#b9b5ad", roughness: 0.82 });
  const clothing = new THREE.MeshStandardMaterial({ color: "#777b80", roughness: 0.88 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
  const shoe = new THREE.MeshStandardMaterial({ color: "#292a2c", roughness: 0.9 });

  const hipY = pose === "sit" ? 0.29 : 0.51;
  const shoulderY = pose === "sit" ? 0.62 : 0.82;
  const headY = pose === "sit" ? 0.76 : 0.94;

  // 골반과 몸통을 겹쳐 연결해 분절된 장난감 같은 인상을 줄인다.
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.115 * h, 18, 14), clothing));
  const torso = capsule(0.115 * h, scale(0, hipY + 0.025, 0), scale(0, shoulderY, 0), clothing);
  torso.scale.x = 1.12;
  group.add(torso);
  group.add(capsule(0.045 * h, scale(0, shoulderY - 0.015, 0), scale(0, shoulderY + 0.045, 0), skin));

  // 어깨선에 작은 색상 포인트를 두어 인물을 구분한다.
  const chestMark = new THREE.Mesh(new THREE.SphereGeometry(0.035 * h, 12, 10), accent);
  chestMark.position.copy(scale(0, shoulderY - 0.12, -0.105));
  group.add(chestMark);

  // 머리와 목
  group.add(capsule(0.035 * h, scale(0, shoulderY + 0.015, 0), scale(0, headY - 0.065, 0), skin));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.073 * h, 20, 16), skin);
  head.position.copy(scale(0, headY, 0));
  head.scale.set(0.92, 1.12, 0.96);
  group.add(head);

  // 코 대신 작은 얼굴 방향 표시. 정면에서만 은은하게 보인다.
  const faceMark = new THREE.Mesh(
    new THREE.SphereGeometry(0.012 * h, 8, 6),
    new THREE.MeshStandardMaterial({ color: "#77736d", roughness: 1 }),
  );
  faceMark.position.copy(scale(0, headY - 0.005, -0.069));
  group.add(faceMark);

  // 팔: 어깨-팔꿈치-손목이 자연스럽게 이어지는 약간 편안한 기본 자세.
  for (const side of [-1, 1]) {
    const shoulder = scale(side * 0.145, shoulderY - 0.035, 0);
    const elbow = pose === "sit"
      ? scale(side * 0.205, shoulderY - 0.19, -0.015)
      : scale(side * 0.205, 0.56, -0.005);
    const wrist = pose === "sit"
      ? scale(side * 0.19, hipY + 0.08, -0.025)
      : scale(side * 0.18, 0.34, -0.025);
    const hand = pose === "sit"
      ? scale(side * 0.19, hipY + 0.025, -0.035)
      : scale(side * 0.18, 0.29, -0.035);

    group.add(joint(0.052 * h, shoulder, clothing));
    group.add(capsule(0.043 * h, shoulder, elbow, clothing));
    group.add(joint(0.036 * h, elbow, clothing));
    group.add(capsule(0.032 * h, elbow, wrist, skin));
    group.add(joint(0.034 * h, wrist, skin));
    group.add(capsule(0.027 * h, wrist, hand, skin));
  }

  // 다리: 허벅지와 종아리를 분리하되 무릎을 겹쳐 연결한다.
  for (const side of [-1, 1]) {
    const hip = scale(side * 0.065, hipY, 0);
    const knee = pose === "sit"
      ? scale(side * 0.07, hipY - 0.015, -0.22)
      : scale(side * 0.075, 0.28, 0.015);
    const ankle = pose === "sit"
      ? scale(side * 0.07, 0.055, -0.25)
      : scale(side * 0.075, 0.035, 0.015);

    group.add(joint(0.065 * h, hip, clothing));
    group.add(capsule(0.062 * h, hip, knee, clothing));
    group.add(joint(0.043 * h, knee, clothing));
    group.add(capsule(0.043 * h, knee, ankle, clothing));

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.052 * h, 12, 10), shoe);
    foot.scale.set(0.82, 0.55, 1.45);
    foot.position.copy(ankle).add(scale(0, -0.012, -0.045));
    group.add(foot);
  }

  return group;
}
