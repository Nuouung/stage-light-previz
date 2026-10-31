import type { Curtain, Cue } from "../../model";
import type { ViewName } from "../stage3d/renderer";

/** 화면 아래 조작부. 버튼이 눌리면 콜백만 부른다. 상태는 직접 바꾸지 않는다. */
export type ControlsProps = {
  title: string;
  dataVersion: string;
  cues: Cue[];
  currentCueId: string;
  curtains: Curtain[];
  view: ViewName;
};

export type ControlsHandlers = {
  onCue(id: string): void;
  onToggleCurtain(id: string): void;
  onView(view: ViewName): void;
};

const VIEW_LABEL: Record<ViewName, string> = { audience: "객석", top: "위", side: "옆" };

export function renderControls(root: HTMLElement, p: ControlsProps, h: ControlsHandlers) {
  const index = p.cues.findIndex((c) => c.id === p.currentCueId);
  const cue = p.cues[index];
  const draws = p.curtains.filter((c) => c.kind === "draw");

  root.innerHTML = `
    <header><strong>${p.title}</strong><span class="ver">데이터 ${p.dataVersion}</span></header>
    <section class="cue">
      <button data-cue="prev" ${index <= 0 ? "disabled" : ""}>◀</button>
      <div class="cue-label">${cue ? `큐 ${cue.number} · ${cue.label}` : "큐 없음"}${cue?.note ? `<small>${cue.note}</small>` : ""}</div>
      <button data-cue="next" ${index >= p.cues.length - 1 ? "disabled" : ""}>▶</button>
    </section>
    <section class="row"><span>보기</span>${(Object.keys(VIEW_LABEL) as ViewName[])
      .map((v) => `<button data-view="${v}" class="${v === p.view ? "on" : ""}">${VIEW_LABEL[v]}</button>`)
      .join("")}</section>
    <section class="row"><span>막</span>${draws
      .map((c) => `<button data-curtain="${c.id}" class="${c.closed ? "on" : ""}">${c.name.split(" (")[0]} ${c.closed ? "닫힘" : "열림"}</button>`)
      .join("")}</section>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-cue]").forEach((b) =>
    b.addEventListener("click", () => {
      const next = p.cues[index + (b.dataset.cue === "next" ? 1 : -1)];
      if (next) h.onCue(next.id);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => b.addEventListener("click", () => h.onView(b.dataset.view as ViewName)));
  root.querySelectorAll<HTMLButtonElement>("[data-curtain]").forEach((b) => b.addEventListener("click", () => h.onToggleCurtain(b.dataset.curtain!)));
}
