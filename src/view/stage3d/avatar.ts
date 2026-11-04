import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Avatar } from "../../model";

/** 불러온 인물 모형 한 벌. 인물마다 복제해서 쓴다. */
export type AvatarAsset = {
  scene: THREE.Object3D;
  /** 모형의 원래 키. 인물 키에 맞춰 크기를 조절할 때 쓴다 */
  height: number;
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<Avatar, Promise<AvatarAsset>>();

/** 모형 파일은 한 번만 받는다. */
export function loadAvatar(id: Avatar): Promise<AvatarAsset> {
  let asset = cache.get(id);
  if (!asset) {
    asset = loader.loadAsync(`${import.meta.env.BASE_URL}avatars/${id}.glb`).then(({ scene }) => {
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(scene);
      return { scene, height: box.max.y - box.min.y };
    });
    cache.set(id, asset);
  }
  return asset;
}
