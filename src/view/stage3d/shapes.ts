import { characterHeight, type Appearance, type Project } from "../../model";
import type { CharacterLook } from "../../player";
import type { ComposedStage } from "../../stage/compose";

/**
 * 렌더러에 넘기는 "그릴 것" 목록. 좌표는 데이터 좌표계 그대로(원점 = 프로시니엄 벽면 중앙·바닥).
 * position은 도형의 바닥 중심.
 */
export type Shape = {
  id: string;
  group: "floor" | "wall" | "curtain" | "batten" | "fixture" | "object" | "character" | "guide";
  /** table·chair·figure는 모양을 렌더러가 만든다 */
  kind: "box" | "cylinder" | "figure" | "table" | "chair";
  position: { x: number; y: number; z: number };
  /** box: 폭(x)·높이(y)·깊이(z). cylinder: 지름(x)·높이(y). 배튼(가로 원기둥)은 x가 길이. figure: y = 키 */
  size: { x: number; y: number; z: number };
  /** 바라보는 방향(도). 0 = 객석 정면 */
  rotationY?: number;
  /** figure 전용: 서 있음 / 앉음 */
  pose?: "stand" | "sit";
  /** figure 전용: 인물 겉모습. 없으면 기본 인물 */
  appearance?: Appearance;
  /** chair 전용: 넘어진 상태 */
  tipped?: boolean;
  /** box 테두리 선을 그린다(검은 단의 층 구분용) */
  outline?: boolean;
  color: string;
  label?: string;
};

const CURTAIN_HEIGHT = 7;
const CURTAIN_THICK = 0.08;
/** 검은 막. 배경과 구분되도록 아주 약간 밝게 */
const BLACK = "#202022";
/** 앤틱 가구 색 (짙은 월넛) */
const WALNUT = "#6b4128";
/** 열린 막이 양옆에 모여 있는 폭(m) */
const GATHERED = 1.0;

/** 공연용 무대(바닥·벽·막·배튼·물체)를 그릴 것 목록으로 바꾼다. */
export function describeStage(composed: ComposedStage): Shape[] {
  const { stage, curtains, objects, fixtures } = composed;
  const W = stage.width;
  const D = stage.depth;
  const shapes: Shape[] = [];

  shapes.push({ id: "floor", group: "floor", kind: "box", position: { x: 0, y: -0.02, z: D / 2 }, size: { x: W, y: 0.02, z: D }, color: stage.floorColor });
  shapes.push({ id: "back-wall", group: "wall", kind: "box", position: { x: 0, y: 0, z: D + 0.1 }, size: { x: W, y: 9, z: 0.2 }, color: "#141416" });

  for (const c of curtains) {
    if (c.kind === "border") {
      shapes.push({ id: c.id, group: "curtain", kind: "box", position: { x: 0, y: CURTAIN_HEIGHT - 1.5, z: c.z }, size: { x: W, y: 1.5, z: CURTAIN_THICK }, color: BLACK, label: c.name });
    } else if (c.kind === "screen") {
      shapes.push({ id: c.id, group: "curtain", kind: "box", position: { x: 0, y: 0, z: c.z }, size: { x: 8, y: 6, z: 0.03 }, color: "#e8e8e8", label: c.name });
    } else if (c.closed) {
      shapes.push({ id: c.id, group: "curtain", kind: "box", position: { x: 0, y: 0, z: c.z }, size: { x: W, y: CURTAIN_HEIGHT, z: CURTAIN_THICK }, color: BLACK, label: c.name });
    } else {
      // 열린 막: 양옆 끝에 모여 있음
      for (const side of [-1, 1]) {
        shapes.push({ id: `${c.id}-${side < 0 ? "l" : "r"}`, group: "curtain", kind: "box", position: { x: side * (W / 2 - GATHERED / 2), y: 0, z: c.z }, size: { x: GATHERED, y: CURTAIN_HEIGHT, z: CURTAIN_THICK * 2 }, color: BLACK, label: c.name });
      }
    }
  }

  for (const p of stage.positions) {
    const [x0, x1] = p.xRange;
    shapes.push({ id: p.id, group: "batten", kind: "cylinder", position: { x: (x0 + x1) / 2, y: p.y, z: p.z }, size: { x: x1 - x0, y: 0.05, z: 0.05 }, color: p.kind === "set" ? "#555555" : "#8a8a8a", label: p.name });
  }

  // 걸린 조명기 몸체: 배튼 아래 작은 상자
  for (const f of fixtures) {
    const p = stage.positions.find((q) => q.id === f.positionId);
    if (!p) continue;
    shapes.push({ id: `fixture-${f.id}`, group: "fixture", kind: "box", position: { x: f.x, y: p.y - 0.42, z: p.z }, size: { x: 0.22, y: 0.3, z: 0.22 }, color: "#2b2b2e", label: f.note });
  }

  for (const o of objects) {
    const base = { id: o.id, group: "object" as const, position: o.position, size: o.size, rotationY: o.rotation, label: o.name };
    if (o.kind === "desk") shapes.push({ ...base, kind: "table", color: WALNUT });
    else if (o.kind === "chair") shapes.push({ ...base, kind: "chair", color: WALNUT, tipped: o.tipped });
    else if (o.kind === "platform") shapes.push({ ...base, kind: "box", color: "#1c1c1e", outline: true });
    else shapes.push({ ...base, kind: "box", color: "#7a5535" });
  }
  return shapes;
}

/** 바닥 테이프 굵기(m)와 색 */
const TAPE = 0.05;
const TAPE_COLOR = "#e0b84a";

/** 연기 공간 경계를 바닥에 붙인 테이프 4줄로. 무대 중앙 기준 폭 width, 앞끝부터 깊이 depth. */
export function describeActingArea(area: { width: number; depth: number }): Shape[] {
  const { width: w, depth: d } = area;
  const tape = (id: string, x: number, z: number, sx: number, sz: number): Shape => ({
    id: `acting-${id}`, group: "guide", kind: "box", position: { x, y: 0.002, z }, size: { x: sx, y: 0.004, z: sz }, color: TAPE_COLOR,
  });
  return [
    tape("front", 0, TAPE / 2, w, TAPE),
    tape("back", 0, d - TAPE / 2, w, TAPE),
    tape("left", -w / 2 + TAPE / 2, d / 2, TAPE, d),
    tape("right", w / 2 - TAPE / 2, d / 2, TAPE, d),
  ];
}

/** 바닥 위 (x, z)에 단상 같은 물체가 있으면 그 윗면 높이를 돌려준다. */
export function floorHeightAt(composed: ComposedStage, x: number, z: number): number {
  let h = 0;
  for (const o of composed.objects) {
    if (o.kind !== "platform") continue;
    const inX = Math.abs(x - o.position.x) <= o.size.x / 2;
    const inZ = Math.abs(z - o.position.z) <= o.size.z / 2;
    if (inX && inZ) h = Math.max(h, o.position.y + o.size.y);
  }
  return h;
}

/** 무대에 있는 인물을 사람 모형으로. 키·자세·방향을 넘기고, 모양은 렌더러가 만든다. */
export function describeCharacters(composed: ComposedStage, project: Project, looks: Record<string, CharacterLook>): Shape[] {
  const shapes: Shape[] = [];
  for (const c of project.characters) {
    const look = looks[c.id];
    if (!look?.onStage || look.x === undefined || look.z === undefined) continue;
    shapes.push({
      id: `char-${c.id}`,
      group: "character",
      kind: "figure",
      position: { x: look.x, y: floorHeightAt(composed, look.x, look.z), z: look.z },
      size: { x: 0.45, y: characterHeight(c), z: 0.3 },
      rotationY: look.facing ?? 0,
      pose: look.posture ?? "stand",
      color: c.color ?? "#d9c2a8",
      appearance: c.appearance,
      label: c.label,
    });
  }
  return shapes;
}
