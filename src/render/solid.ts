import * as THREE from 'three';
import { bbox } from '../geometry/polygon.ts';
import { annuliToShape, axialSection, perpendicularSection } from '../geometry/sections.ts';
import type { Cut, HalfProfile, MultiPolygon, Ring } from '../geometry/types.ts';

export const COLORS = {
  solid: 0x4f8ef7,
  figure: 0xff8a3d,
  section: 0xf59e0b,
  axis: 0xe5484d,
  plane: 0x7c5cff,
};

/** 회전체 크기 정보. 여러 그림을 같은 축척으로 맞출 때 쓴다. */
export interface Bounds3 {
  radius: number;
  minH: number;
  maxH: number;
}

export function profileBounds(profile: HalfProfile): Bounds3 {
  const b = bbox(profile);
  return { radius: b.maxX, minH: b.minY, maxH: b.maxY };
}

export function mergeBounds(list: Bounds3[]): Bounds3 {
  return {
    radius: Math.max(...list.map((b) => b.radius)),
    minH: Math.min(...list.map((b) => b.minH)),
    maxH: Math.max(...list.map((b) => b.maxH)),
  };
}

/**
 * 반쪽 단면 경계의 각 변을 Y축 둘레로 thetaMax(라디안)만큼 돌린 겉면.
 * 점 [r, h]는 각도 φ에서 (r cos φ, h, −r sin φ)로 간다(= rotation.y = φ 와 같은 방향).
 */
export function buildSolidGeometry(profile: HalfProfile, thetaMax = Math.PI * 2, segments = 64): THREE.BufferGeometry {
  const steps = Math.max(1, Math.ceil((segments * thetaMax) / (Math.PI * 2)));
  const positions: number[] = [];
  const indices: number[] = [];
  for (const poly of profile) for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const [ra, ha] = ring[i];
      const [rb, hb] = ring[(i + 1) % ring.length];
      if (ra < 1e-9 && rb < 1e-9) continue; // 축 위의 변은 면을 만들지 않는다
      const base = positions.length / 3;
      for (let j = 0; j <= steps; j++) {
        const phi = (thetaMax * j) / steps;
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        positions.push(ra * c, ha, -ra * s, rb * c, hb, -rb * s);
      }
      for (let j = 0; j < steps; j++) {
        const i0 = base + 2 * j;
        indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function shapesFromMulti(mp: MultiPolygon): THREE.Shape[] {
  return mp.map(([outer, ...holes]) => {
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes = holes.map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    return shape;
  });
}

export function shapesFromRings(rings: Ring[]): THREE.Shape[] {
  return shapesFromMulti(rings.map((r) => [r]));
}

export interface SolidSceneOptions {
  /** 돌린 각도(도). 360이면 완성된 회전체. */
  angleDeg: number;
  /** 회전 중인 평면도형(축 좌표, r이 음수일 수 있음). angleDeg < 360일 때 표시. */
  figureRings?: Ring[];
  cut?: { cut: Cut; angleDeg: number; clip: boolean } | null;
}

/** 회전체 + 회전축 + (선택) 움직이는 도형 + (선택) 자르는 평면을 담은 그룹. */
export function buildSolidGroup(profile: HalfProfile, opts: SolidSceneOptions): THREE.Group {
  const group = new THREE.Group();
  const bounds = profileBounds(profile);
  const size = Math.max(bounds.radius * 2, bounds.maxH - bounds.minH, 1);
  const theta = (Math.min(360, Math.max(0, opts.angleDeg)) / 180) * Math.PI;

  const clippingPlanes: THREE.Plane[] = [];
  const cut = opts.cut ?? null;
  if (cut && cut.clip) {
    if (cut.cut.kind === 'axial') {
      const a = (cut.angleDeg / 180) * Math.PI;
      // 카메라 쪽(+z) 절반을 잘라내 잘린 면이 보이게 한다
      clippingPlanes.push(new THREE.Plane(new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)), 0));
    } else {
      clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), cut.cut.h));
    }
  }

  if (theta > 0) {
    const solid = new THREE.Mesh(
      buildSolidGeometry(profile, theta),
      new THREE.MeshStandardMaterial({
        color: COLORS.solid,
        roughness: 0.45,
        metalness: 0.05,
        side: THREE.DoubleSide,
        clippingPlanes,
      }),
    );
    group.add(solid);
  }

  if (opts.figureRings && opts.angleDeg < 360) {
    const fig = new THREE.Mesh(
      new THREE.ShapeGeometry(shapesFromRings(opts.figureRings)),
      new THREE.MeshBasicMaterial({ color: COLORS.figure, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    fig.rotation.y = theta;
    group.add(fig);
  }

  const axisLen = bounds.maxH - bounds.minH + size * 0.6;
  const axis = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.008, size * 0.008, axisLen, 8),
    new THREE.MeshBasicMaterial({ color: COLORS.axis }),
  );
  axis.position.y = (bounds.minH + bounds.maxH) / 2;
  group.add(axis);

  if (cut && !cut.clip) {
    const planeMat = new THREE.MeshBasicMaterial({
      color: COLORS.plane,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const midH = (bounds.minH + bounds.maxH) / 2;
    if (cut.cut.kind === 'axial') {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, axisLen), planeMat);
      plane.position.y = midH;
      plane.rotation.y = (cut.angleDeg / 180) * Math.PI;
      group.add(plane);
    } else {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, size * 1.5), planeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = cut.cut.h;
      group.add(plane);
    }
  }
  if (cut && cut.clip) {
    const sectionMat = new THREE.MeshBasicMaterial({ color: COLORS.section, side: THREE.DoubleSide });
    if (cut.cut.kind === 'axial') {
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesFromMulti(axialSection(profile))), sectionMat);
      mesh.rotation.y = (cut.angleDeg / 180) * Math.PI;
      group.add(mesh);
    } else {
      const shape = annuliToShape(perpendicularSection(profile, cut.cut.h));
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesFromMulti(shape)), sectionMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = cut.cut.h;
      group.add(mesh);
    }
  }
  return group;
}

/** 그룹 안의 지오메트리·재질을 모두 해제한다. */
export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m: THREE.Material) => m.dispose());
    }
  });
}

/** bounds 크기에 맞춰 카메라를 비스듬한 위에서 바라보게 둔다. center는 바라볼 높이. */
export function fitCamera(camera: THREE.PerspectiveCamera, bounds: Bounds3, centerH: number): THREE.Vector3 {
  // 회전체를 감싸는 구가 화면 세로에 여유 있게 들어가도록 거리를 정한다
  const sphere = Math.max(Math.hypot(bounds.radius, (bounds.maxH - bounds.minH) / 2), 0.5);
  const dist = (sphere / Math.sin(((camera.fov / 2) * Math.PI) / 180)) * 1.35;
  const dir = new THREE.Vector3(1, 0.75, 1.4).normalize();
  const target = new THREE.Vector3(0, centerH, 0);
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.near = dist / 100;
  camera.far = dist * 10;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target;
}

export function addLights(scene: THREE.Scene, camera: THREE.Camera): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 2, 3);
  camera.add(key);
  scene.add(camera);
}
