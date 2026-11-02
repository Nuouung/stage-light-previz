import * as THREE from "three";

/**
 * 무대 블로킹용 단순 인체 모델.
 * 원점은 발바닥 중심, 얼굴은 -z(객석) 방향.
 * 관절을 구슬처럼 드러내지 않고 옷의 실루엣으로 몸의 형태를 읽게 한다.
 */

function capsuleBetween(
  radius: number,
  from: THREE.Vector3,
  to: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(length - radius * 2, 0.001), 6, 14),
    material,
  );
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

export function buildFigure(h: number, pose: "stand" | "sit", color: string): THREE.Group {
  const group = new THREE.Group();
  const p = (x: number, y: number, z: number) => new THREE.Vector3(x * h, y * h, z * h);

  const skin = new THREE.MeshStandardMaterial({ color: "#c5b9a8", roughness: 0.9 });
  const clothes = new THREE.MeshStandardMaterial({ color: "#555b61", roughness: 0.92 });
  const trousers = new THREE.MeshStandardMaterial({ color: "#454a50", roughness: 0.94 });
  const shoes = new THREE.MeshStandardMaterial({ color: "#25282b", roughness: 0.95 });
  const marker = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });

  const seated = pose === "sit";
  const hipY = seated ? 0.29 : 0.50;
  const shoulderY = seated ? 0.62 : 0.81;
  const headY = seated ? 0.76 : 0.93;

  // 몸통: 허리에서 어깨로 자연스럽게 넓어지는 하나의 매끄러운 실루엣.
  const torsoProfile = [
    new THREE.Vector2(0.075 * h, (hipY - 0.015) * h),
    new THREE.Vector2(0.092 * h, (hipY + 0.035) * h),
    new THREE.Vector2(0.105 * h, (hipY + 0.13) * h),
    new THREE.Vector2(0.095 * h, (shoulderY - 0.12) * h),
    new THREE.Vector2(0.125 * h, (shoulderY - 0.035) * h),
    new THREE.Vector2(0.145 * h, shoulderY * h),
    new THREE.Vector2(0.125 * h, (shoulderY + 0.035) * h),
    new THREE.Vector2(0, (shoulderY + 0.045) * h),
  ];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 24), clothes);
  group.add(torso);

  // 골반은 허리 아래에 부드럽게 겹쳐 붙인다.
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), trousers);
  pelvis.scale.set(0.105 * h, 0.085 * h, 0.075 * h);
  pelvis.position.copy(p(0, hipY + 0.005, 0));
  group.add(pelvis);

  // 목과 머리
  group.add(capsuleBetween(0.033 * h, p(0, shoulderY - 0.005, 0), p(0, headY - 0.055, 0), skin));
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), skin);
  head.scale.set(0.067 * h, 0.083 * h, 0.066 * h);
  head.position.copy(p(0, headY, 0));
  group.add(head);

  // 얼굴 방향만 알아볼 수 있는 아주 작은 코 형태
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.009 * h, 10, 8), skin);
  nose.scale.set(0.8, 0.8, 1.4);
  nose.position.copy(p(0, headY - 0.005, -0.064));
  group.add(nose);

  // 배우 식별 표식은 가슴의 작은 평면 원형 마크로 제한한다.
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.022 * h, 20), marker);
  badge.position.copy(p(0, shoulderY - 0.13, -0.119));
  group.add(badge);

  // 팔: 상박과 하박은 같은 옷감으로 겹쳐 연결하고, 관절 구체는 노출하지 않는다.
  for (const side of [-1, 1]) {
    const shoulder = p(side * 0.145, shoulderY - 0.015, 0);
    const elbow = seated
      ? p(side * 0.19, shoulderY - 0.19, -0.025)
      : p(side * 0.19, 0.55, -0.015);
    const wrist = seated
      ? p(side * 0.18, hipY + 0.045, -0.045)
      : p(side * 0.17, 0.31, -0.035);

    group.add(capsuleBetween(0.047 * h, shoulder, elbow, clothes));
    group.add(capsuleBetween(0.035 * h, elbow, wrist, clothes));

    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), skin);
    hand.scale.set(0.027 * h, 0.045 * h, 0.025 * h);
    hand.position.copy(wrist).add(p(0, -0.025, -0.005));
    group.add(hand);
  }

  // 다리: 바지 실루엣을 유지하면서 무릎에서 살짝 방향이 바뀌게 한다.
  for (const side of [-1, 1]) {
    const hip = p(side * 0.065, hipY - 0.025, 0);
    const knee = seated
      ? p(side * 0.07, hipY - 0.015, -0.20)
      : p(side * 0.072, 0.27, 0.012);
    const ankle = seated
      ? p(side * 0.07, 0.055, -0.23)
      : p(side * 0.072, 0.045, 0.015);

    group.add(capsuleBetween(0.061 * h, hip, knee, trousers));
    group.add(capsuleBetween(0.043 * h, knee, ankle, trousers));

    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), shoes);
    foot.scale.set(0.052 * h, 0.027 * h, 0.092 * h);
    foot.position.copy(ankle).add(p(0, -0.018, -0.035));
    group.add(foot);
  }

  return group;
}
