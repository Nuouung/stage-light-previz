import type { Blocking, CueState, Project } from "../model";

/** 화면에 그릴 조명 한 대의 최종 값 (fixtureId 제외) */
export type LightLook = Omit<CueState, "fixtureId">;
/** 화면에 그릴 인물 한 명의 최종 값 (characterId 제외) */
export type CharacterLook = Omit<Blocking, "characterId">;

/** 어느 큐 시점의 무대 전체 상태 */
export type Look = {
  lights: Record<string, LightLook>;
  characters: Record<string, CharacterLook>;
};

/** 적힌 값만 덮어쓴다. undefined는 "안 적음"이라 이전 값을 유지한다. */
function merge<T extends object>(prev: T | undefined, next: T): T {
  const out = { ...(prev ?? {}) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(next)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/**
 * 트래킹 방식으로 큐 시점의 최종 상태를 계산한다.
 * 첫 큐부터 cueId까지 순서대로 바뀐 값만 덮어쓴다.
 */
export function resolveCue(project: Project, cueId: string): Look {
  const index = project.cues.findIndex((c) => c.id === cueId);
  if (index < 0) throw new Error(`큐 '${cueId}'가 없음`);

  const look: Look = { lights: {}, characters: {} };
  for (const cue of project.cues.slice(0, index + 1)) {
    for (const { fixtureId, ...rest } of cue.lights) {
      look.lights[fixtureId] = merge(look.lights[fixtureId], rest);
    }
    for (const { characterId, ...rest } of cue.blocking) {
      look.characters[characterId] = merge(look.characters[characterId], rest);
    }
  }
  return look;
}

/** 다음 큐 id. 마지막이면 null. */
export function nextCueId(project: Project, cueId: string): string | null {
  const i = project.cues.findIndex((c) => c.id === cueId);
  return project.cues[i + 1]?.id ?? null;
}

/** 이전 큐 id. 처음이면 null. */
export function prevCueId(project: Project, cueId: string): string | null {
  const i = project.cues.findIndex((c) => c.id === cueId);
  return i > 0 ? (project.cues[i - 1]?.id ?? null) : null;
}
