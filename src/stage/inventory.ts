import type { Stage, Staging } from "../model";

/**
 * 행잉이 공연장 보유 수량을 넘는 기종을 찾아 경고 문장으로 돌려준다.
 * 빌려 오는 장비가 있을 수 있어 오류가 아니라 경고다.
 */
export function inventoryWarnings(stage: Stage, staging: Staging): string[] {
  const hung = new Map<string, number>();
  for (const f of staging.hanging) hung.set(f.typeId, (hung.get(f.typeId) ?? 0) + 1);

  const warnings: string[] = [];
  for (const [typeId, count] of hung) {
    const owned = stage.inventory.find((i) => i.typeId === typeId)?.count ?? 0;
    if (count > owned) warnings.push(`${typeId}: ${count}대를 걸었는데 ${stage.venue} 보유는 ${owned}대 (대여 필요)`);
  }
  return warnings;
}
