import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { figureInAxisFrame, halfProfile } from '../geometry/profile.ts';
import type { Cut, Figure, HalfProfile, Ring } from '../geometry/types.ts';
import { addLights, buildSolidGroup, disposeGroup, fitCamera, profileBounds } from './solid.ts';

export interface ViewCut {
  cut: Cut;
  /** 축을 포함하는 평면의 방향(도). perpendicular일 때는 무시. */
  angleDeg: number;
}

/** 탐구 모드·해설에서 쓰는 손으로 돌려 볼 수 있는 3D 보기. */
export class SolidViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  private controls: OrbitControls;
  private group: THREE.Group | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;

  private profile: HalfProfile = [];
  private figureRings: Ring[] = [];
  private angleDeg = 360;
  private cut: ViewCut | null = null;

  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.setClearColor(0xf3f5fb);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    addLights(this.scene, this.camera);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', () => this.requestRender());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  get currentProfile(): HalfProfile {
    return this.profile;
  }

  setFigure(figure: Figure | null): void {
    this.profile = figure ? halfProfile(figure) : [];
    this.figureRings = figure ? figureInAxisFrame(figure) : [];
    if (this.profile.length > 0) {
      const b = profileBounds(this.profile);
      const target = fitCamera(this.camera, b, (b.minH + b.maxH) / 2);
      this.controls.target.copy(target);
      this.controls.update();
    }
    this.rebuild();
  }

  setAngle(deg: number): void {
    this.angleDeg = deg;
    this.rebuild();
  }

  setCut(cut: ViewCut | null): void {
    this.cut = cut;
    this.rebuild();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.group) disposeGroup(this.group);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private rebuild(): void {
    if (this.group) {
      this.scene.remove(this.group);
      disposeGroup(this.group);
      this.group = null;
    }
    if (this.profile.length > 0) {
      this.group = buildSolidGroup(this.profile, {
        angleDeg: this.angleDeg,
        figureRings: this.figureRings,
        cut: this.cut ? { ...this.cut, clip: true } : null,
      });
      this.scene.add(this.group);
    }
    this.requestRender();
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }
}
