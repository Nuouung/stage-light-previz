import type { Curtain, Project, Stage, StageObject, Staging } from "../model";

/** 무대에 실제로 놓인 물체 = 작품의 물체 정의 + 배치의 위치 */
export type PlacedObject = StageObject & {
  position: { x: number; y: number; z: number };
  rotation: number;
  tipped: boolean;
};

/** 공연용 무대 = 공연장 + 작품의 세트 + 배치(위치·막 설정). 저장하지 않고 매번 합성한다. */
export type ComposedStage = {
  stage: Stage;
  curtains: Curtain[];
  objects: PlacedObject[];
};

/** 원본(공연장·작품)은 건드리지 않고 공연용 무대를 새로 만들어 돌려준다. */
export function composeStage(stage: Stage, project: Project, staging: Staging): ComposedStage {
  if (staging.stageId !== stage.id) {
    throw new Error(`배치 '${staging.id}'는 공연장 '${staging.stageId}'용인데 '${stage.id}'가 들어옴`);
  }
  if (staging.projectId !== project.id) {
    throw new Error(`배치 '${staging.id}'는 작품 '${staging.projectId}'용인데 '${project.id}'가 들어옴`);
  }
  const curtains = stage.curtains
    .filter((c) => !staging.hiddenCurtains.includes(c.id))
    .map((c) => ({
      ...c,
      closed: staging.curtainOverrides[c.id] ?? c.closed,
    }));
  const objects: PlacedObject[] = [];
  for (const p of staging.placements) {
    const def = project.objects.find((o) => o.id === p.objectId);
    if (def) objects.push({ ...def, position: p.position, rotation: p.rotation, tipped: p.tipped });
  }
  return { stage, curtains, objects };
}
