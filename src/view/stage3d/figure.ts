import * as THREE from "three";

/**
 * 사람 모형(마네킹) 만들기. 렌더러 전용.
 * 키 h를 기준으로 비율만 정해 둔 단순한 몸: 머리·몸통·팔·다리.
 * 만들어진 그룹의 원점 = 발바닥 중심, 얼굴은 -z(객석) 쪽을 본다.
 */

/** 서 있을 때 각 부위 높이(키에 대한 비율) */
const HIP = 0.5;
const SHOULDER = 0.82;
const HEAD_R = 0.07;
const HEAD_Y = 0.93;
/** 앉았을 때 엉덩이 높이(키에 대한 비율). 1.7m면 약 0.46m = 의자 높이 */
const SEAT = 0.27;

function capsule(radius: number, from: THREE.Vector3, to: THREE.Vector3, mat: THREE.Material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(len - 2 * radius, 0.001), 4, 10), mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export function buildFigure(h: number, pose: "stand" | "sit", color: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x * h, y * h, z * h);

  // 앉으면 윗몸 전체가 이만큼 내려온다
  const drop = pose === "sit" ? HIP - SEAT : 0;
  const hipY = HIP - drop;

  // 머리·몸통·팔 (자세와 무관하게 모양은 같고 높이만 내려온다)
  const head = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * h, 16, 12), body);
  head.position.copy(v(0, HEAD_Y - drop, 0));
  g.add(head);
  // 코: 어느 쪽을 보는지 알 수 있게
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018 * h, 8, 6), body);
  nose.position.copy(v(0, HEAD_Y - drop - 0.005, -HEAD_R));
  g.add(nose);
  g.add(capsule(0.1 * h, v(0, hipY + 0.04, 0), v(0, SHOULDER - drop, 0), body));
  for (const s of [-1, 1]) {
    g.add(capsule(0.032 * h, v(s * 0.13, SHOULDER - drop - 0.02, 0), v(s * 0.15, hipY - 0.04, 0), body));
  }

  // 다리
  for (const s of [-1, 1]) {
    const hip = v(s * 0.055, hipY, 0);
    if (pose === "sit") {
      const knee = v(s * 0.06, hipY, -0.24);
      g.add(capsule(0.045 * h, hip, knee, body));
      g.add(capsule(0.04 * h, knee, v(s * 0.06, 0.02, -0.26), body));
    } else {
      g.add(capsule(0.045 * h, hip, v(s * 0.06, 0.02, 0), body));
    }
  }
  return g;
}
