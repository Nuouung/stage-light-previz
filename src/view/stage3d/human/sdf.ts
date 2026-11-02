/**
 * 부호 있는 거리 함수(SDF) 도구. 값이 0인 곳이 표면, 음수가 안쪽.
 * 인체를 부품 조립이 아니라 "하나로 녹아 붙은 표면"으로 만들기 위해 쓴다. 전부 순수 함수.
 */
export type Sdf = (x: number, y: number, z: number) => number;
export type P3 = readonly [number, number, number];

/** 부드러운 합집합. k가 클수록 이음새가 넓게 녹아 붙는다. */
export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
}

/** 부드러운 교집합. 빼기는 smax(a, -b, k). */
export function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

/** 두 점을 잇고 굵기가 r1에서 r2로 변하는 막대. */
export function cone(a: P3, b: P3, r1: number, r2: number): Sdf {
  const bx = b[0] - a[0];
  const by = b[1] - a[1];
  const bz = b[2] - a[2];
  const inv = 1 / (bx * bx + by * by + bz * bz || 1);
  return (x, y, z) => {
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const t = Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) * inv));
    return Math.hypot(px - bx * t, py - by * t, pz - bz * t) - (r1 + (r2 - r1) * t);
  };
}

/** 타원체. */
export function ellipsoid(c: P3, r: P3): Sdf {
  return (x, y, z) => {
    const px = x - c[0];
    const py = y - c[1];
    const pz = z - c[2];
    const k0 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
    if (k0 < 1e-6) return -Math.min(r[0], r[1], r[2]);
    const k1 = Math.hypot(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]));
    return (k0 * (k0 - 1)) / k1;
  };
}

/** 표면 방향(단위 벡터). 값이 0이 되는 쪽으로 점을 옮길 때도 쓴다. */
export function gradient(f: Sdf, x: number, y: number, z: number, e: number): [number, number, number] {
  const a = f(x + e, y - e, z - e);
  const b = f(x - e, y - e, z + e);
  const c = f(x - e, y + e, z - e);
  const d = f(x + e, y + e, z + e);
  const gx = a - b - c + d;
  const gy = -a - b + c + d;
  const gz = -a + b - c + d;
  const len = Math.hypot(gx, gy, gz) || 1;
  return [gx / len, gy / len, gz / len];
}
