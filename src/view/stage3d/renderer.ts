import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildFigure } from "./figure";
import { buildChair, buildTable, tipOver } from "./furniture";
import type { Shape } from "./shapes";

/**
 * 데이터 좌표 → three.js 좌표.
 * 객석에서 무대를 보는 카메라(+z 방향)를 기준으로, 데이터의 +x(상수 쪽)가 화면 오른쪽에 오도록 x를 뒤집는다.
 */
const toThree = (x: number, y: number, z: number) => new THREE.Vector3(-x, y, z);

export type ViewName = "audience" | "top" | "side";

const VIEWS: Record<ViewName, { eye: [number, number, number]; target: [number, number, number] }> = {
  audience: { eye: [0, 3.2, -6.5], target: [0, 1.5, 4.5] },
  // 객석이 화면 아래에 오도록 아주 살짝 객석 쪽에서 내려다본다
  top: { eye: [0, 22, 4.6], target: [0, 0, 4.7] },
  side: { eye: [16, 5, 2], target: [0, 1.5, 4.5] },
};

/** 그릴 것 목록(Shape[])을 받아 화면에 그리기만 한다. 무엇을 그릴지는 정하지 않는다. */
export function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#050608");

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  // 작업등: 조명기가 들어오기 전까지 무대 구조가 보이도록 은은하게
  scene.add(new THREE.HemisphereLight("#ffffff", "#202020", 0.9));
  const work = new THREE.DirectionalLight("#ffffff", 0.6);
  work.position.copy(toThree(2, 10, -6));
  scene.add(work);

  // 객석 바닥 (무대 앞 공간)
  const house = new THREE.Mesh(new THREE.PlaneGeometry(14, 16), new THREE.MeshStandardMaterial({ color: "#0a0a0a" }));
  house.rotation.x = -Math.PI / 2;
  house.position.copy(toThree(0, -0.03, -8));
  scene.add(house);

  // 바닥 1m 격자: 거리 감 잡기용
  const grid = new THREE.GridHelper(20, 20, "#3a3a3a", "#202020");
  grid.position.copy(toThree(0, 0.001, 5));
  scene.add(grid);

  const layer = new THREE.Group();
  scene.add(layer);

  function meshOf(s: Shape): THREE.Object3D {
    if (s.kind === "figure") {
      const fig = buildFigure(s.size.y, s.pose ?? "stand", s.color);
      fig.position.copy(toThree(s.position.x, s.position.y, s.position.z));
      if (s.rotationY) fig.rotation.y = (-s.rotationY * Math.PI) / 180;
      fig.name = s.id;
      return fig;
    }
    if (s.kind === "table" || s.kind === "chair") {
      let model = s.kind === "table" ? buildTable(s.size.x, s.size.y, s.size.z, s.color) : buildChair(s.size.x, s.size.y, s.size.z, s.color);
      if (s.tipped) model = tipOver(model);
      model.position.copy(toThree(s.position.x, s.position.y, s.position.z));
      if (s.rotationY) model.rotation.y = (-s.rotationY * Math.PI) / 180;
      model.name = s.id;
      return model;
    }
    const mat = new THREE.MeshStandardMaterial({ color: s.color, roughness: s.group === "floor" ? 0.35 : 0.85 });
    let mesh: THREE.Mesh;
    if (s.kind === "cylinder" && s.group === "batten") {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(s.size.y / 2, s.size.y / 2, s.size.x, 8), mat);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.copy(toThree(s.position.x, s.position.y, s.position.z));
    } else if (s.kind === "cylinder") {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(s.size.x / 2, s.size.x / 2, s.size.y, 16), mat);
      mesh.position.copy(toThree(s.position.x, s.position.y + s.size.y / 2, s.position.z));
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(s.size.x, s.size.y, s.size.z), mat);
      mesh.position.copy(toThree(s.position.x, s.position.y + s.size.y / 2, s.position.z));
      if (s.rotationY) mesh.rotation.y = (-s.rotationY * Math.PI) / 180;
      if (s.outline) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: "#4a4a50" }));
        mesh.add(edges);
      }
    }
    mesh.name = s.id;
    return mesh;
  }

  function draw(shapes: Shape[]) {
    for (const child of [...layer.children]) {
      layer.remove(child);
      child.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    for (const s of shapes) layer.add(meshOf(s));
  }

  function setView(name: ViewName) {
    const v = VIEWS[name];
    camera.position.copy(toThree(...v.eye));
    controls.target.copy(toThree(...v.target));
    controls.update();
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 세로 화면에서도 무대 폭이 다 들어오도록 가로 시야각(70도)을 기준으로 세로 시야각을 정한다
    const hfov = (70 * Math.PI) / 180;
    camera.fov = Math.max(45, (2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180) / Math.PI);
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();
  setView("audience");
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return { draw, setView };
}
