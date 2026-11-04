import { ShaderChunk } from "three";
import { describe, expect, it } from "vitest";
import { patchSpotLightChunk } from "../src/view/stage3d/lightCut";

const rect = { xMin: -4, xMax: 4, zMin: 0, zMax: 5 };

describe("조명 자르기", () => {
  it("지금 쓰는 three.js의 스포트라이트 계산에 자르기가 들어간다", () => {
    const patched = patchSpotLightChunk(ShaderChunk.lights_pars_begin, rect);
    expect(patched).toContain("lightCutCoverage(viewToWorld(spotLight.position)");
    expect(patched).toContain("vec4(-4.0000, 4.0000, 0.0000, 5.0000)");
  });

  it("three.js 코드가 달라져 넣을 자리가 없으면 조용히 넘어가지 않고 에러를 낸다", () => {
    expect(() => patchSpotLightChunk("다른 코드", rect)).toThrow();
  });
});
