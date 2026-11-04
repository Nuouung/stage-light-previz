import type { Shape } from "./shapes";

/** 이전 무대와 새 무대의 차이. 렌더러는 여기 적힌 물체만 손댄다. */
export type ShapeChanges = {
  /** 새로 생긴 물체 */
  add: Shape[];
  /** 없어진 물체의 id */
  remove: string[];
  /** 모양이 달라져 새로 만들어야 하는 물체 */
  replace: Shape[];
  /** 위치·방향만 달라진 인물 */
  move: Shape[];
};

/** 위치·방향을 뺀 인물의 내용. 이게 같으면 다시 만들지 않고 옮기기만 한다. */
const figureBody = (s: Shape) => JSON.stringify({ ...s, position: undefined, rotationY: undefined });
const figurePlace = (s: Shape) => JSON.stringify([s.position, s.rotationY ?? 0]);

/**
 * 두 목록을 id로 비교한다.
 * 인물의 위치·방향만 예외로 두고, 그 밖의 값은 무엇이든 다르면 새로 만든다.
 * 그래서 값이 바뀌었는데 화면에 반영되지 않는 일이 생기지 않는다.
 */
export function planChanges(prev: ReadonlyMap<string, Shape>, next: readonly Shape[]): ShapeChanges {
  const changes: ShapeChanges = { add: [], remove: [], replace: [], move: [] };
  const nextIds = new Set(next.map((s) => s.id));
  for (const id of prev.keys()) {
    if (!nextIds.has(id)) changes.remove.push(id);
  }
  for (const s of next) {
    const old = prev.get(s.id);
    if (!old) changes.add.push(s);
    else if (old.kind === "figure" && s.kind === "figure") {
      if (figureBody(old) !== figureBody(s)) changes.replace.push(s);
      else if (figurePlace(old) !== figurePlace(s)) changes.move.push(s);
    } else if (JSON.stringify(old) !== JSON.stringify(s)) changes.replace.push(s);
  }
  return changes;
}
