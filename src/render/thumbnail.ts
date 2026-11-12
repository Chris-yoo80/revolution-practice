import * as THREE from 'three';
import { bbox, ringsToMulti } from '../geometry/polygon.ts';
import type { Cut, Figure, HalfProfile } from '../geometry/types.ts';
import {
  addLights,
  type Bounds3,
  buildSolidGroup,
  COLORS,
  disposeGroup,
  fitCamera,
  profileBounds,
  shapesFromRings,
} from './solid.ts';

/** 보기 썸네일은 WebGL 렌더러 하나를 돌려 쓴다(태블릿의 WebGL 컨텍스트 개수 제한 대비). */
let shared: { renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } | null = null;

function getShared(size: number) {
  if (!shared) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0xf3f5fb);
    shared = { renderer, camera: new THREE.PerspectiveCamera(35, 1, 0.1, 1000) };
  }
  shared.renderer.setPixelRatio(1);
  shared.renderer.setSize(size, size, false);
  return shared;
}

function snapshot(object: THREE.Object3D, bounds: Bounds3, centerH: number, size: number): string {
  const { renderer, camera } = getShared(size);
  const scene = new THREE.Scene();
  addLights(scene, camera);
  scene.add(object);
  fitCamera(camera, bounds, centerH);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL();
  camera.clear();
  disposeGroup(object);
  return url;
}

export interface SolidImageOptions {
  /** 여러 보기의 축척을 맞추기 위한 공통 크기. 없으면 자기 크기에 맞춘다. */
  fitBounds?: Bounds3;
  /** 자르는 평면을 보여줄 때(자르지는 않음) */
  cut?: Cut;
  size?: number;
}

export function solidImage(profile: HalfProfile, opts: SolidImageOptions = {}): string {
  const own = profileBounds(profile);
  const group = buildSolidGroup(profile, {
    angleDeg: 360,
    cut: opts.cut ? { cut: opts.cut, angleDeg: 35, clip: false } : null,
  });
  return snapshot(group, opts.fitBounds ?? own, (own.minH + own.maxH) / 2, opts.size ?? 240);
}

/** '돌리지 않고 밀어낸' 각기둥 그림(오답 보기용). */
export function prismImage(figure: Figure, size = 240): string {
  const b = bbox(ringsToMulti(figure.pieces));
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const depth = Math.max(w, h) * 0.8;
  const geo = new THREE.ExtrudeGeometry(shapesFromRings(figure.pieces), { depth, bevelEnabled: false });
  geo.translate(-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2, -depth / 2);
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.solid, roughness: 0.45, metalness: 0.05 })),
  );
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x1e3a8a })));
  const r = Math.max(w, depth) / 2;
  return snapshot(group, { radius: r, minH: -h / 2, maxH: h / 2 }, 0, size);
}
