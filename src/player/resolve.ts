import { lightKey, type Blocking, type CueLight, type ObjectMove, type Project, type Staging } from "../model";

/** 화면에 그릴 빛 하나의 최종 값 */
export type LightLook = Omit<CueLight, "zone" | "direction">;
/** 화면에 그릴 인물 한 명의 최종 값 (characterId 제외) */
export type CharacterLook = Omit<Blocking, "characterId">;
/** 큐에서 옮긴 물체 하나의 최종 값 (objectId 제외). 옮긴 적 없는 물체는 없다 */
export type ObjectLook = Omit<ObjectMove, "objectId">;

/** 어느 큐 시점의 무대 전체 상태 */
export type Look = {
  lights: Record<string, LightLook>;
  characters: Record<string, CharacterLook>;
  objects: Record<string, ObjectLook>;
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
 * 큐 순서는 작품(Project)에서, 큐마다 바뀌는 값은 배치(Staging)에서 가져온다.
 */
export function resolveCue(project: Project, staging: Staging, cueId: string): Look {
  const index = project.cues.findIndex((c) => c.id === cueId);
  if (index < 0) throw new Error(`큐 '${cueId}'가 없음`);

  const valuesByCue = new Map(staging.cues.map((v) => [v.cueId, v]));
  const look: Look = { lights: {}, characters: {}, objects: {} };
  for (const cue of project.cues.slice(0, index + 1)) {
    const values = valuesByCue.get(cue.id);
    if (!values) continue;
    for (const { zone, direction, ...rest } of values.lights) {
      const key = lightKey(zone, direction);
      look.lights[key] = merge(look.lights[key], rest);
    }
    for (const { characterId, ...rest } of values.blocking) {
      look.characters[characterId] = merge(look.characters[characterId], rest);
    }
    for (const { objectId, ...rest } of values.objects) {
      look.objects[objectId] = merge(look.objects[objectId], rest);
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
