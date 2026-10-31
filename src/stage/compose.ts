import type { Curtain, Project, Stage, StageObject } from "../model";

/** 공연용 무대 = 공연장(Stage) + 공연의 물체(Object) + 공연별 막 설정. 저장하지 않고 매번 합성한다. */
export type ComposedStage = {
  stage: Stage;
  curtains: Curtain[];
  objects: StageObject[];
};

/** 공연장 원본은 건드리지 않고, 공연용 무대를 새로 만들어 돌려준다. */
export function composeStage(stage: Stage, project: Project): ComposedStage {
  if (project.stageId !== stage.id) {
    throw new Error(`공연 '${project.id}'는 공연장 '${project.stageId}'를 쓰는데 '${stage.id}'가 들어옴`);
  }
  const curtains = stage.curtains.map((c) => ({
    ...c,
    closed: project.curtainOverrides[c.id] ?? c.closed,
  }));
  return { stage, curtains, objects: project.objects };
}
