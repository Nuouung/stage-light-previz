import type { Sdf } from "./sdf";

export type Bounds = { min: readonly [number, number, number]; max: readonly [number, number, number] };
export type RawMesh = { positions: number[]; indices: number[] };

/**
 * 거리 함수의 0 표면을 삼각형 메시로 바꾼다(Naive Surface Nets).
 * 격자 칸마다 정점 하나를 두고 이웃 칸끼리 사각형으로 잇는다. 삼각형 앞면은 바깥을 향한다.
 */
export function surfaceNets(sdf: Sdf, bounds: Bounds, cell: number): RawMesh {
  const nx = Math.ceil((bounds.max[0] - bounds.min[0]) / cell) + 1;
  const ny = Math.ceil((bounds.max[1] - bounds.min[1]) / cell) + 1;
  const nz = Math.ceil((bounds.max[2] - bounds.min[2]) / cell) + 1;
  const [ox, oy, oz] = bounds.min;
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);

  const field = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        field[at(i, j, k)] = sdf(ox + i * cell, oy + j * cell, oz + k * cell);
      }
    }
  }

  const vertexOf = new Int32Array(nx * ny * nz).fill(-1);
  const positions: number[] = [];
  // 정육면체 꼭짓점 8개와 모서리 12개
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] as const;
  const edge = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
  const v = new Float64Array(8);

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const q = corner[c]!;
          v[c] = field[at(i + q[0], j + q[1], k + q[2])]!;
          if (v[c]! < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of edge) {
          const va = v[a]!;
          const vb = v[b]!;
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const qa = corner[a]!;
          const qb = corner[b]!;
          sx += qa[0] + (qb[0] - qa[0]) * t;
          sy += qa[1] + (qb[1] - qa[1]) * t;
          sz += qa[2] + (qb[2] - qa[2]) * t;
          n++;
        }
        vertexOf[at(i, j, k)] = positions.length / 3;
        positions.push(ox + (i + sx / n) * cell, oy + (j + sy / n) * cell, oz + (k + sz / n) * cell);
      }
    }
  }

  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const here = field[at(i, j, k)]! < 0;
        if (here !== field[at(i + 1, j, k)]! < 0) {
          quad(vertexOf[at(i, j - 1, k - 1)]!, vertexOf[at(i, j, k - 1)]!, vertexOf[at(i, j, k)]!, vertexOf[at(i, j - 1, k)]!, !here);
        }
        if (here !== field[at(i, j + 1, k)]! < 0) {
          quad(vertexOf[at(i - 1, j, k - 1)]!, vertexOf[at(i - 1, j, k)]!, vertexOf[at(i, j, k)]!, vertexOf[at(i, j, k - 1)]!, !here);
        }
        if (here !== field[at(i, j, k + 1)]! < 0) {
          quad(vertexOf[at(i - 1, j - 1, k)]!, vertexOf[at(i, j - 1, k)]!, vertexOf[at(i, j, k)]!, vertexOf[at(i - 1, j, k)]!, !here);
        }
      }
    }
  }
  return { positions, indices };
}
