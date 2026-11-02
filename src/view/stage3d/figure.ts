import * as THREE from "three";

/**
 * Stage blocking용 단순화 인체.
 * 발바닥 중심이 원점이며 얼굴은 -Z(객석) 방향.
 * 원통 조립 대신 부드러운 몸통 프로파일과 캡슐형 사지를 사용한다.
 */
function ellipsoid(
  size: [number, number, number],
  position: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), material);
  mesh.scale.set(...size);
  mesh.position.copy(position);
  return mesh;
}

function capsuleBetween(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radiusEnd = radius,
): THREE.Mesh {
  const delta = new THREE.Vector3().subVectors(to, from);
  const length = delta.length();
  const geometry = new THREE.CylinderGeometry(radiusEnd, radius, Math.max(0.001, length - radius - radiusEnd), 16, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  // 구형 관절이 이음새를 덮어 자연스러운 실루엣을 만든다.
  const capA = ellipsoid([radius, radius, radius], from, material);
  const capB = ellipsoid([radiusEnd, radiusEnd, radiusEnd], to, material);
  const group = new THREE.Group();
  group.add(mesh, capA, capB);
  return group as unknown as THREE.Mesh;
}

function latheBody(height: number, profile: [number, number][], material: THREE.Material): THREE.Mesh {
  const points = profile.map(([radius, y]) => new THREE.Vector2(radius * height, y * height));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, 32), material);
  mesh.position.y = 0;
  return mesh;
}

export function buildFigure(height: number, pose: "stand" | "sit", color: string): THREE.Group {
  const h = height;
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x * h, y * h, z * h);
  const seated = pose === "sit";

  const skin = new THREE.MeshStandardMaterial({ color: "#c99f7e", roughness: 0.88 });
  const shirt = new THREE.MeshStandardMaterial({ color: "#52616b", roughness: 0.92 });
  const trousers = new THREE.MeshStandardMaterial({ color: "#343b45", roughness: 0.94 });
  const shoes = new THREE.MeshStandardMaterial({ color: "#25282b", roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: "#302923", roughness: 0.96 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });

  // 성인 평균 비율에 가까운 머리-몸통-다리 비율.
  const hipY = seated ? 0.34 : 0.51;
  const shoulderY = seated ? 0.64 : 0.82;
  const headY = seated ? 0.79 : 0.94;
  const footZ = 0;

  if (!seated) {
    // 바지 다리: 허벅지와 종아리를 서로 다른 굵기로 연결.
    for (const side of [-1, 1]) {
      const hip = v(side * 0.047, 0.50, 0.005);
      const knee = v(side * 0.052, 0.275, 0.018);
      const ankle = v(side * 0.054, 0.075, 0.015);
      group.add(capsuleBetween(hip, knee, 0.061 * h, trousers, 0.047 * h));
      group.add(capsuleBetween(knee, ankle, 0.047 * h, trousers, 0.031 * h));
      group.add(ellipsoid([0.045*h, 0.025*h, 0.085*h], v(side*0.054, 0.035, -0.035), shoes));
    }
  } else {
    // 착석은 허벅지를 앞으로, 종아리를 아래로 접은 단순화 포즈.
    for (const side of [-1, 1]) {
      const hip = v(side * 0.047, hipY, 0);
      const knee = v(side * 0.05, hipY - 0.015, -0.205);
      const ankle = v(side * 0.052, 0.07, -0.22);
      group.add(capsuleBetween(hip, knee, 0.058*h, trousers, 0.048*h));
      group.add(capsuleBetween(knee, ankle, 0.046*h, trousers, 0.032*h));
      group.add(ellipsoid([0.043*h, 0.024*h, 0.078*h], v(side*0.052, 0.035, -0.245), shoes));
    }
  }

  // 골반에서 어깨로 이어지는 하나의 매끈한 옷 실루엣.
  const torsoProfile: [number, number][] = [
    [0.105, hipY - 0.025],
    [0.12, hipY + 0.025],
    [0.105, hipY + 0.10],
    [0.092, hipY + 0.19],
    [0.112, shoulderY - 0.09],
    [0.145, shoulderY - 0.035],
    [0.16, shoulderY],
    [0.135, shoulderY + 0.025],
    [0.075, shoulderY + 0.035],
    [0.0, shoulderY + 0.035],
  ];
  group.add(latheBody(h, torsoProfile, shirt));

  // 목과 머리. 턱을 약간 좁혀 둥근 구체 느낌을 줄인다.
  group.add(capsuleBetween(v(0, shoulderY + 0.005, 0), v(0, headY - 0.052, 0), 0.034*h, skin));
  group.add(ellipsoid([0.078*h, 0.094*h, 0.071*h], v(0, headY, 0), skin));
  // 머리카락: 정수리와 뒤통수를 덮는 짧은 헤어 실루엣.
  const hairCap = ellipsoid([0.081*h, 0.062*h, 0.075*h], v(0, headY + 0.046, 0.006*h), hair);
  group.add(hairCap);
  group.add(ellipsoid([0.078*h, 0.063*h, 0.025*h], v(0, headY + 0.005, 0.052*h), hair));
  // 귀와 코, 눈은 멀리서 얼굴 방향을 읽을 수 있을 정도로만 표현.
  for (const side of [-1, 1]) {
    group.add(ellipsoid([0.012*h, 0.022*h, 0.012*h], v(side*0.078, headY-0.008, 0), skin));
    group.add(ellipsoid([0.006*h, 0.006*h, 0.004*h], v(side*0.027, headY+0.005, -0.068), hair));
  }
  group.add(ellipsoid([0.012*h, 0.018*h, 0.014*h], v(0, headY-0.027, -0.074), skin));

  // 팔은 몸통 옆으로 자연스럽게 떨어뜨린다.
  for (const side of [-1, 1]) {
    const shoulder = v(side*0.145, shoulderY-0.025, 0);
    const elbow = seated ? v(side*0.19, shoulderY-0.18, -0.015) : v(side*0.19, 0.57, -0.012);
    const wrist = seated ? v(side*0.17, hipY+0.045, -0.055) : v(side*0.17, 0.31, -0.025);
    const hand = seated ? v(side*0.17, hipY+0.005, -0.065) : v(side*0.17, 0.255, -0.03);
    group.add(capsuleBetween(shoulder, elbow, 0.047*h, shirt, 0.037*h));
    group.add(capsuleBetween(elbow, wrist, 0.037*h, shirt, 0.026*h));
    group.add(capsuleBetween(wrist, hand, 0.025*h, skin, 0.021*h));
  }

  // 셔츠의 작은 가슴 포인트. 캐릭터 식별색을 과하게 쓰지 않는다.
  const pin = new THREE.Mesh(new THREE.CircleGeometry(0.012*h, 16), accent);
  pin.position.copy(v(-0.075, shoulderY-0.105, -0.112));
  group.add(pin);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}
