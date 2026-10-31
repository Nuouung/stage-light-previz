// 연결 코드만 둔다: 데이터 읽기 → store → (store 구독) → 도형 목록 → 렌더러·조작부
import "./style.css";
import { Project, Stage } from "./model";
import { resolveCue } from "./player";
import { composeStage } from "./stage/compose";
import { createStore } from "./store/store";
import { createRenderer, type ViewName } from "./view/stage3d/renderer";
import { describeCharacters, describeStage } from "./view/stage3d/shapes";
import { renderControls } from "./view/ui/controls";
import projectJson from "../data/projects/bodojichim.json";
import stageJson from "../data/stages/bonomaru.json";

type AppState = { project: Project; stage: Stage; cueId: string; view: ViewName };

const project = Project.parse(projectJson);
const stage = Stage.parse(stageJson);

const store = createStore<AppState>({ project, stage, cueId: project.cues[0]?.id ?? "", view: "audience" });

const renderer = createRenderer(document.getElementById("stage") as HTMLCanvasElement);
const controlsRoot = document.getElementById("controls")!;

function render(s: AppState) {
  const composed = composeStage(s.stage, s.project);
  const look = s.cueId ? resolveCue(s.project, s.cueId) : { lights: {}, characters: {} };
  renderer.draw([...describeStage(composed), ...describeCharacters(composed, s.project, look.characters)]);
  renderControls(
    controlsRoot,
    { title: `${s.project.title} · ${s.stage.venue}`, dataVersion: s.project.dataVersion, cues: s.project.cues, currentCueId: s.cueId, curtains: composed.curtains, view: s.view },
    {
      onCue: (id) => store.setState({ cueId: id }),
      onView: (view) => {
        renderer.setView(view);
        store.setState({ view });
      },
      onToggleCurtain: (id) => {
        const p = store.get().project;
        const current = composed.curtains.find((c) => c.id === id)?.closed ?? false;
        store.setState({ project: { ...p, curtainOverrides: { ...p.curtainOverrides, [id]: !current } } });
      },
    },
  );
}

store.subscribe(render);
render(store.get());
