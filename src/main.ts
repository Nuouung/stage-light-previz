// 1단계 뷰어 전의 임시 화면: 데이터가 제대로 읽히는지만 보여준다.
import { Project, Stage } from "./model";
import { composeStage } from "./stage/compose";
import projectJson from "../data/projects/bodojichim.json";
import stageJson from "../data/stages/bonomaru.json";

const project = Project.parse(projectJson);
const composed = composeStage(Stage.parse(stageJson), project);

const app = document.getElementById("app")!;
app.innerHTML = `
  <h1>${project.title} · ${composed.stage.venue}</h1>
  <p>무대 ${composed.stage.width} × ${composed.stage.depth}m · 배튼 ${composed.stage.positions.length}개 · 막 ${composed.curtains.length}개 · 조명 ${composed.stage.fixtures.length}대 · 물체 ${composed.objects.length}개 · 인물 ${project.characters.length}명</p>
  <ol>${project.cues.map((c) => `<li>${c.number}. ${c.label}</li>`).join("")}</ol>
  <p><small>데이터 ${project.dataVersion} · 3D 뷰어는 다음 단계</small></p>
`;
