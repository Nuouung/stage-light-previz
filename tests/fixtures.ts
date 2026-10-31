import type { Project } from "../src/model";

/** 테스트용 작은 공연. 조명 a·b, 인물 p 하나. */
export function tinyProject(): Project {
  return {
    id: "tiny",
    title: "테스트",
    stageId: "s",
    curtainOverrides: {},
    objects: [],
    characters: [{ id: "p", role: "판사", label: "판사" }],
    scenes: [],
    dataVersion: "test",
    cues: [
      {
        id: "q1", number: 1, label: "1", fadeIn: 3,
        lights: [{ fixtureId: "a", intensity: 100 }, { fixtureId: "b", intensity: 50 }],
        blocking: [{ characterId: "p", x: 0, z: 2, posture: "sit", onStage: true }],
      },
      { id: "q2", number: 2, label: "2", fadeIn: 3, lights: [{ fixtureId: "b", intensity: 80 }], blocking: [] },
      {
        id: "q3", number: 3, label: "3", fadeIn: 3,
        lights: [{ fixtureId: "a", intensity: 0 }],
        blocking: [{ characterId: "p", posture: "stand" }],
      },
    ],
  };
}
