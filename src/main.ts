// 연결 코드만 둔다: 데이터 읽기(공연장·작품·배치) → store → (store 구독) → 도형 목록 → 렌더러·조작부
import "./style.css";
import { DEFAULT_AVATAR, FixtureType, Project, Stage, Staging } from "./model";
import { resolveCue } from "./player";
import { composeStage } from "./stage/compose";
import { inventoryWarnings } from "./stage/inventory";
import { createStore } from "./store/store";
import { loadAvatar } from "./view/stage3d/avatar";
import { createRenderer, type ViewName } from "./view/stage3d/renderer";
import { describeLights } from "./view/stage3d/lights";
import { describeActingArea, describeCharacters, describeStage } from "./view/stage3d/shapes";
import { renderControls } from "./view/ui/controls";
import projectJson from "../data/projects/bodojichim.json";
import stageJson from "../data/stages/bonomaru.json";
import stagingJson from "../data/stagings/bodojichim-bonomaru.json";

// 조명기 종류는 폴더째 읽는다
const fixtureTypes = Object.values(import.meta.glob("../data/fixture-types/*.json", { eager: true, import: "default" })).map((j) => FixtureType.parse(j));

type AppState = { project: Project; stage: Stage; staging: Staging; cueId: string; view: ViewName; showActingArea: boolean; showWorkLight: boolean; haze: boolean };

const project = Project.parse(projectJson);
const stage = Stage.parse(stageJson);
const staging = Staging.parse(stagingJson);

inventoryWarnings(stage, staging).forEach((w) => console.warn(w));

// 인물이 등장하는 순간 기다리지 않도록 미리 받아 둔다
project.characters.forEach((c) => void loadAvatar(c.avatar ?? DEFAULT_AVATAR).catch(() => {}));

const store = createStore<AppState>({ project, stage, staging, cueId: project.cues[0]?.id ?? "", view: "audience", showActingArea: true, showWorkLight: false, haze: true });

const renderer = createRenderer(document.getElementById("stage") as HTMLCanvasElement);
const controlsRoot = document.getElementById("controls")!;

function render(s: AppState) {
  const composed = composeStage(s.stage, s.project, s.staging);
  const look = s.cueId ? resolveCue(s.project, s.staging, s.cueId) : { lights: {}, characters: {} };
  const area = s.staging.actingArea;
  const guides = area && s.showActingArea ? describeActingArea(area) : [];
  renderer.setWorkLight(s.showWorkLight);
  renderer.setHaze(s.haze ? 1 : 0);
  renderer.setLights(describeLights(composed, fixtureTypes, look.lights));
  renderer.draw([...describeStage(composed), ...guides, ...describeCharacters(composed, s.project, look.characters)]);
  renderControls(
    controlsRoot,
    { title: `${s.project.title} · ${s.stage.venue}`, dataVersion: s.staging.dataVersion, cues: s.project.cues, currentCueId: s.cueId, curtains: composed.curtains, view: s.view, hasActingArea: !!area, showActingArea: s.showActingArea, showWorkLight: s.showWorkLight, haze: s.haze },
    {
      onCue: (id) => store.setState({ cueId: id }),
      onView: (view) => {
        renderer.setView(view);
        store.setState({ view });
      },
      onToggleActingArea: () => store.setState({ showActingArea: !store.get().showActingArea }),
      onToggleHaze: () => store.setState({ haze: !store.get().haze }),
      onToggleWorkLight: () => store.setState({ showWorkLight: !store.get().showWorkLight }),
      onToggleCurtain: (id) => {
        const st = store.get().staging;
        const current = composed.curtains.find((c) => c.id === id)?.closed ?? false;
        store.setState({ staging: { ...st, curtainOverrides: { ...st.curtainOverrides, [id]: !current } } });
      },
    },
  );
}

store.subscribe(render);
render(store.get());
