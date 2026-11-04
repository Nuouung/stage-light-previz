import { describe, expect, it } from "vitest";
import { interpolate, nextCueId, prevCueId, resolveCue } from "../src/player";
import { tinyProject, tinyStaging } from "./fixtures";

describe("트래킹", () => {
  it("2번 큐에 적지 않은 빛은 1번 큐 밝기를 유지한다", () => {
    const look = resolveCue(tinyProject(), tinyStaging(), "q2");
    expect(look.lights["down-left/front"]?.intensity).toBe(100);
    expect(look.lights["down-right/top"]?.intensity).toBe(80);
  });

  it("3번 큐에서 바꾼 빛만 바뀌고 나머지는 직전 값을 따라간다", () => {
    const look = resolveCue(tinyProject(), tinyStaging(), "q3");
    expect(look.lights["down-left/front"]?.intensity).toBe(0);
    expect(look.lights["down-right/top"]?.intensity).toBe(80);
  });

  it("인물 자세만 바꾸면 위치는 이전 큐 그대로 남는다", () => {
    const p = resolveCue(tinyProject(), tinyStaging(), "q3").characters.p;
    expect(p).toMatchObject({ x: 0, z: 2, posture: "stand", onStage: true });
  });

  it("없는 큐를 부르면 에러가 난다", () => {
    expect(() => resolveCue(tinyProject(), tinyStaging(), "nope")).toThrow();
  });
});

describe("작품과 배치 나누기", () => {
  it("배치에 값이 없는 큐는 직전 큐 상태를 그대로 유지한다", () => {
    const staging = { ...tinyStaging(), cues: tinyStaging().cues.filter((c) => c.cueId !== "q2") };
    expect(resolveCue(tinyProject(), staging, "q2")).toEqual(resolveCue(tinyProject(), staging, "q1"));
  });
});

describe("큐 넘기기", () => {
  it("다음 큐와 이전 큐를 찾고, 끝에서는 null을 준다", () => {
    const p = tinyProject();
    expect(nextCueId(p, "q1")).toBe("q2");
    expect(nextCueId(p, "q3")).toBeNull();
    expect(prevCueId(p, "q1")).toBeNull();
    expect(prevCueId(p, "q3")).toBe("q2");
  });
});

describe("페이드", () => {
  const p = tinyProject();
  const q1 = resolveCue(p, tinyStaging(), "q1");
  const q3 = resolveCue(p, tinyStaging(), "q3");

  it("페이드 절반 지점에서 밝기는 두 큐의 중간값이다", () => {
    expect(interpolate(q1, q3, 0.5).lights["down-left/front"]?.intensity).toBe(50);
  });

  it("인물 위치·자세는 페이드가 끝나는 순간에 바뀐다", () => {
    expect(interpolate(q1, q3, 0.9).characters.p?.posture).toBe("sit");
    expect(interpolate(q1, q3, 1).characters.p?.posture).toBe("stand");
  });
});
