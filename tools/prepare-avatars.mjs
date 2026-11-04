// 100 Avatars의 VRM 파일을 앱에서 쓸 GLB로 바꾼다. 원본이 바뀌거나 인물을 추가할 때만 돌린다.
// 사용법: node tools/prepare-avatars.mjs <VRM 폴더> [public/avatars]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

/** 앱에서 부르는 이름 → 원본 파일 이름 */
const AVATARS = {
  cappy: "006_Cappy",
  retroman: "018_Retroman",
  kyle: "069_Kyle",
  bizdude: "102_Bizdude",
  kate: "038_Kate",
  erika: "053_Erika",
  shiro: "058_Shiro",
};
const TEXTURE_SIZE = 512;

const [from, to = "public/avatars"] = process.argv.slice(2);
if (!from) throw new Error("VRM 폴더를 알려 주세요");
mkdirSync(to, { recursive: true });

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
for (const [id, file] of Object.entries(AVATARS)) {
  const doc = await io.read(join(from, `${file}.vrm`));
  for (const node of doc.getRoot().listNodes()) {
    // 뼈 이름에서 원본별 접두어를 뗀다: vis_char_018:mixamorig:LeftArm → LeftArm, AvatarsR2_0002:Hips → Hips
    node.setName(node.getName().replace(/^.*:/, ""));
  }
  for (const material of doc.getRoot().listMaterials()) {
    // 원본은 조명을 받지 않는 재질이다. 무대 조명에 반응하도록 일반 재질로 바꾼다
    material.setExtension("KHR_materials_unlit", null);
    material.setMetallicFactor(0).setRoughnessFactor(0.8);
  }
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === "KHR_materials_unlit") ext.dispose();
  }
  await doc.transform(
    dedup(),
    prune({ keepLeaves: true, keepAttributes: true }),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [TEXTURE_SIZE, TEXTURE_SIZE] }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await io.write(join(to, `${id}.glb`), doc);
  console.log(id, "←", file);
}
