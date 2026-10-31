import * as THREE from "three";

/**
 * 가구 모형 만들기. 렌더러 전용.
 * 〈보도지침〉에서 고른 디자인(앤틱 테이블 1400, 앤틱 원목 의자)을 단순화한 모양.
 * 만들어진 그룹의 원점 = 바닥 중심. 의자는 앉은 사람이 -z(객석) 쪽을 보도록 만든다.
 */

const wood = (color: string, rough = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });

/** 둥글게 깎은 다리(턴드 레그). 바닥(y=0)에서 height까지, 지름 d 기준. */
function turnedLeg(height: number, d: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  // [지름 비율, 높이 비율]을 아래에서 위로. 발 → 가는 목 → 몸통 → 구슬 → 윗부분
  const profile: [number, number][] = [
    [0.7, 0.04], [0.55, 0.06], [0.75, 0.05], [0.6, 0.3], [0.85, 0.05], [0.65, 0.08],
    [0.9, 0.06], [0.7, 0.22], [0.95, 0.04],
  ];
  const total = profile.reduce((s, [, h]) => s + h, 0);
  let y = 0;
  for (const [r, h] of profile) {
    const hh = (h / total) * height;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry((r * d) / 2, (r * d) / 2, hh, 14), mat);
    seg.position.y = y + hh / 2;
    g.add(seg);
    y += hh;
  }
  return g;
}

/** 앤틱 테이블: 상판 + 테두리 몰딩 + 앞치마(에이프런) + 턴드 레그 4개. */
export function buildTable(w: number, h: number, d: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const body = wood(color);
  const topMat = wood(new THREE.Color(color).offsetHSL(0, 0, 0.05).getStyle(), 0.4);

  const topT = 0.035;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, topT, d), topMat);
  top.position.y = h - topT / 2;
  g.add(top);
  // 상판 아래 몰딩: 조금 작고 얇은 판을 한 겹 더
  const mold = new THREE.Mesh(new THREE.BoxGeometry(w - 0.03, 0.015, d - 0.03), body);
  mold.position.y = h - topT - 0.0075;
  g.add(mold);

  const legD = 0.065;
  const inset = 0.06;
  const apronH = 0.1;
  const apronY = h - topT - 0.015 - apronH / 2;
  // 앞치마: 다리 사이를 잇는 띠
  for (const sz of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * inset, apronH, 0.022), body);
    a.position.set(0, apronY, sz * (d / 2 - inset));
    g.add(a);
  }
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.022, apronH, d - 2 * inset), body);
    a.position.set(sx * (w / 2 - inset), apronY, 0);
    g.add(a);
  }
  const legH = h - topT - 0.015;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // 다리 윗부분은 앞치마가 붙는 네모 기둥
      const block = new THREE.Mesh(new THREE.BoxGeometry(legD, apronH, legD), body);
      block.position.set(sx * (w / 2 - inset), apronY, sz * (d / 2 - inset));
      g.add(block);
      const leg = turnedLeg(legH - apronH, legD, body);
      leg.position.set(sx * (w / 2 - inset), 0, sz * (d / 2 - inset));
      g.add(leg);
    }
  }
  return g;
}

/** 앤틱 원목 의자: 앉는 판 + 턴드 레그 + 둥근 위 가로대와 살대 등받이. */
export function buildChair(w: number, h: number, d: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const body = wood(color);
  const seatH = 0.45;
  const seatT = 0.03;
  const legD = 0.04;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, seatT, d), wood(new THREE.Color(color).offsetHSL(0, 0, 0.05).getStyle(), 0.45));
  seat.position.y = seatH - seatT / 2;
  g.add(seat);

  const lx = w / 2 - 0.035;
  const lz = d / 2 - 0.035;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = turnedLeg(seatH - seatT, legD, body);
      leg.position.set(sx * lx, 0, sz * lz);
      g.add(leg);
    }
    // 다리 사이 가로대(옆)
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, d - 0.07, 8), body);
    rung.rotation.x = Math.PI / 2;
    rung.position.set(sx * lx, 0.15, 0);
    g.add(rung);
  }

  // 등받이: 뒷다리 위로 올라가는 기둥 2개 + 위 가로대 + 살대
  const backH = h - seatH;
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, backH, 10), body);
    post.position.set(sx * lx, seatH + backH / 2, lz);
    post.rotation.x = -0.08; // 살짝 뒤로 기울임
    g.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.07, 0.025), body);
  rail.position.set(0, h - 0.04, lz + 0.03);
  rail.rotation.x = -0.08;
  g.add(rail);
  const spindles = 4;
  for (let i = 0; i < spindles; i++) {
    const x = -lx + ((i + 1) * (2 * lx)) / (spindles + 1);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, backH - 0.08, 8), body);
    s.position.set(x, seatH + (backH - 0.08) / 2, lz + 0.015);
    s.rotation.x = -0.08;
    g.add(s);
  }
  return g;
}

/** 의자를 뒤로 넘어뜨린다: 등받이가 바닥에 닿게 눕히고, 가장 낮은 점을 바닥(y=0)에 맞춘다. */
export function tipOver(chair: THREE.Group): THREE.Group {
  const holder = new THREE.Group();
  chair.rotation.x = Math.PI / 2 - 0.05;
  holder.add(chair);
  const box = new THREE.Box3().setFromObject(holder);
  chair.position.y -= box.min.y;
  const center = box.getCenter(new THREE.Vector3());
  chair.position.z -= center.z;
  return holder;
}
