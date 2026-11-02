import * as THREE from "three";

/**
 * 무대 블로킹용 인체 마네킹.
 * 원점은 발바닥 중심, 얼굴은 -z(객석) 방향.
 * 실제 배우의 위치·방향을 읽기 위한 슬림한 성인 인체 비율을 사용한다.
 */

function segment(
  radius: number,
  from: THREE.Vector3,
  to: THREE.Vector3,
  material: THREE.Material,
  radiusEnd = radius,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radiusEnd, radius, length, 12, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function ellipsoid(
  radius: [number, number, number],
  position: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), material);
  mesh.scale.set(...radius);
  mesh.position.copy(position);
  return mesh;
}

export function buildFigure(h: number, pose: "stand" | "sit", color: string): THREE.Group {
  const group = new THREE.Group();
  const p = (x: number, y: number, z: number) => new THREE.Vector3(x * h, y * h, z * h);
  const seated = pose === "sit";

  const skin = new THREE.MeshStandardMaterial({ color: "#c9b9a5", roughness: 0.9 });
  const clothes = new THREE.MeshStandardMaterial({ color: "#55585b", roughness: 0.94 });
  const pants = new THREE.MeshStandardMaterial({ color: "#414448", roughness: 0.95 });
  const shoes = new THREE.MeshStandardMaterial({ color: "#242629", roughness: 0.95 });
  const marker = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });

  const hipY = seated ? 0.29 : 0.49;
  const shoulderY = seated ? 0.61 : 0.81;
  const headY = seated ? 0.75 : 0.93;

  // 몸통: 좁은 허리에서 가슴과 어깨로 자연스럽게 넓어지는 절제된 실루엣.
  const profile = [
    new THREE.Vector2(0.061 * h, (hipY - 0.025) * h),
    new THREE.Vector2(0.071 * h, (hipY + 0.035) * h),
    new THREE.Vector2(0.079 * h, (hipY + 0.13) * h),
    new THREE.Vector2(0.091 * h, (shoulderY - 0.12) * h),
    new THREE.Vector2(0.105 * h, (shoulderY - 0.045) * h),
    new THREE.Vector2(0.112 * h, shoulderY * h),
    new THREE.Vector2(0.098 * h, (shoulderY + 0.025) * h),
    new THREE.Vector2(0, (shoulderY + 0.03) * h),
  ];
  group.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), clothes));

  // 목은 짧고 가늘게, 머리는 성인 인체 비율에 맞춘다.
  group.add(segment(0.022 * h, p(0, shoulderY + 0.005, 0), p(0, headY - 0.055, 0), skin));
  group.add(ellipsoid([0.061 * h, 0.071 * h, 0.059 * h], p(0, headY, 0), skin));

  // 얼굴 방향 표시를 과장하지 않는다.
  group.add(ellipsoid([0.006 * h, 0.006 * h, 0.012 * h], p(0, headY - 0.006, -0.058), skin));

  // 가슴의 작은 식별점. 캐릭터 전체를 원색으로 칠하지 않는다.
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.014 * h, 16), marker);
  badge.position.copy(p(0, shoulderY - 0.115, -0.103));
  group.add(badge);

  // 팔: 어깨에서 손목까지 가늘어지며, 팔꿈치 관절은 별도 구체로 표현하지 않는다.
  for (const side of [-1, 1]) {
    const shoulder = p(side * 0.108, shoulderY - 0.025, 0);
    const elbow = seated
      ? p(side * 0.135, shoulderY - 0.17, -0.012)
      : p(side * 0.137, 0.57, -0.012);
    const wrist = seated
      ? p(side * 0.13, hipY + 0.055, -0.025)
      : p(side * 0.145, 0.34, -0.02);

    group.add(segment(0.031 * h, shoulder, elbow, clothes, 0.025 * h));
    group.add(segment(0.023 * h, elbow, wrist, clothes, 0.017 * h));
    group.add(ellipsoid([0.018 * h, 0.034 * h, 0.014 * h], p(side * (seated ? 0.13 : 0.145), (seated ? hipY + 0.015 : 0.29), -0.025), skin));
  }

  // 골반과 다리: 허벅지·종아리의 굵기를 줄이고 다리 사이 간격도 자연스럽게 둔다.
  for (const side of [-1, 1]) {
    const hip = p(side * 0.043, hipY, 0);
    const knee = seated
      ? p(side * 0.05, hipY - 0.005, -0.19)
      : p(side * 0.05, 0.27, 0.012);
    const ankle = seated
      ? p(side * 0.05, 0.055, -0.22)
      : p(side * 0.052, 0.045, 0.015);

    group.add(segment(0.043 * h, hip, knee, pants, 0.034 * h));
    group.add(segment(0.033 * h, knee, ankle, pants, 0.023 * h));

    const foot = ellipsoid(
      [0.034 * h, 0.018 * h, 0.065 * h],
      ankle.clone().add(p(0, -0.018, -0.028)),
      shoes,
    );
    group.add(foot);
  }

  return group;
}
