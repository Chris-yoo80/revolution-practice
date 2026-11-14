import { axisThrough } from '../geometry/profile.ts';
import type { Axis, AxisDir, Figure, Ring, Vec2 } from '../geometry/types.ts';
import { validateRing } from '../geometry/validate.ts';
import { axisScreenLine, COLORS_2D, drawGrid, drawRings, toScreen, toWorld, type View } from '../render/draw2d.ts';

/** 회전축 고르는 방식: 세로·가로(끌어서 이동) 또는 비스듬히(변 누르기 / 점 두 개) */
export type AxisMode = AxisDir | 'oblique';

/** 모눈 작업판이 보여주는 세계 좌표 범위 */
const WORLD = { minX: -7, maxX: 7, minY: -1, maxY: 9 };
const VERTEX_HIT_PX = 24;
const AXIS_HIT_PX = 18;

export const EDITOR_MESSAGES = {
  'too-few': '점을 3개 이상 찍어야 도형이 돼요.',
  'zero-area': '넓이가 없는 도형은 돌릴 수 없어요.',
  'self-intersect': '변끼리 겹치지 않게 그려 주세요.',
  drawHint: '모눈의 점을 차례로 눌러 도형을 그리고, 첫 점을 다시 누르면 완성돼요.',
  obliqueHint: '도형의 변을 누르면 그 변이 회전축이 돼요. 모눈의 점 두 개를 눌러 비스듬한 축을 그을 수도 있어요.',
  obliqueSecond: '축이 지나갈 두 번째 점을 눌러 주세요.',
} as const;

export interface GridEditorCallbacks {
  onChange(figure: Figure | null): void;
  onMessage(message: string): void;
  /** 축 종류가 바뀌었을 때(예: 비스듬한 축이 있는 프리셋을 고름) 버튼 표시를 맞추기 위해 부른다. */
  onAxisModeChange?(mode: AxisMode): void;
}

type Drag = { kind: 'axis' } | { kind: 'vertex'; piece: number; index: number; original: Ring } | null;

export class GridEditor {
  private ctx: CanvasRenderingContext2D;
  private view: View = { cx: 0, cy: 4, scale: 40, width: 0, height: 0 };
  private dpr = 1;
  private figure: Figure | null = null;
  private axis: Axis = { dir: 'vertical', pos: 0 };
  private editable = false;
  private drawing: Vec2[] | null = null;
  /** 비스듬한 축을 고르는 중이면 지금까지 누른 점(0~1개) */
  private pickingAxis: Vec2[] | null = null;
  private drag: Drag = null;
  private resizeObserver: ResizeObserver;
  private canvas: HTMLCanvasElement;
  private callbacks: GridEditorCallbacks;

  constructor(canvas: HTMLCanvasElement, callbacks: GridEditorCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.ctx = canvas.getContext('2d')!;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  get currentAxis(): Axis {
    return this.axis;
  }

  setFigure(figure: Figure | null, editable: boolean): void {
    this.figure = figure ? { pieces: figure.pieces.map((r) => r.map((p) => [...p] as Vec2)), axis: figure.axis } : null;
    if (figure) {
      this.axis = { ...figure.axis };
      this.callbacks.onAxisModeChange?.(this.axis.dir);
    }
    this.editable = editable;
    this.drawing = null;
    this.pickingAxis = null;
    this.redraw();
    this.emit();
  }

  startDrawing(): void {
    this.figure = null;
    this.drawing = [];
    this.editable = true;
    this.callbacks.onMessage(EDITOR_MESSAGES.drawHint);
    this.redraw();
    this.emit();
  }

  clear(): void {
    this.figure = null;
    this.drawing = null;
    this.redraw();
    this.emit();
  }

  setAxisMode(mode: AxisMode): void {
    if (mode === 'oblique') {
      this.pickingAxis = [];
      this.callbacks.onMessage(EDITOR_MESSAGES.obliqueHint);
      this.redraw();
      return;
    }
    this.setAxis({ dir: mode, pos: 0 });
  }

  private setAxis(axis: Axis): void {
    this.axis = axis;
    this.pickingAxis = null;
    this.callbacks.onAxisModeChange?.(axis.dir);
    if (this.figure) this.figure = { ...this.figure, axis };
    this.callbacks.onMessage('');
    this.redraw();
    this.emit();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  private emit(): void {
    this.callbacks.onChange(this.figure ? { pieces: this.figure.pieces, axis: this.axis } : null);
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const scale = Math.min(w / (WORLD.maxX - WORLD.minX), h / (WORLD.maxY - WORLD.minY));
    this.view = {
      cx: (WORLD.minX + WORLD.maxX) / 2,
      cy: (WORLD.minY + WORLD.maxY) / 2,
      scale,
      width: w,
      height: h,
    };
    this.redraw();
  }

  private pointerWorld(e: PointerEvent): { world: Vec2; snapped: Vec2; px: Vec2 } {
    const rect = this.canvas.getBoundingClientRect();
    const px: Vec2 = [e.clientX - rect.left, e.clientY - rect.top];
    const world = toWorld(this.view, px[0], px[1]) as Vec2;
    const snapped: Vec2 = [
      Math.min(WORLD.maxX, Math.max(WORLD.minX, Math.round(world[0]))),
      Math.min(WORLD.maxY, Math.max(WORLD.minY, Math.round(world[1]))),
    ];
    return { world, snapped, px };
  }

  /** 세로·가로축까지의 화면 거리. 비스듬한 축은 끌어서 옮기지 않으므로 무한대. */
  private axisDistancePx(px: Vec2): number {
    const axis = this.axis;
    if (axis.dir === 'oblique') return Infinity;
    const [ax, ay] = toScreen(this.view, axis.pos, axis.pos);
    return axis.dir === 'vertical' ? Math.abs(px[0] - ax) : Math.abs(px[1] - ay);
  }

  /** 화면 점 px 근처(양 끝 제외)에 있는 도형의 변. */
  private hitEdge(px: Vec2): [Vec2, Vec2] | null {
    if (!this.figure) return null;
    for (const ring of this.figure.pieces) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const [ax, ay] = toScreen(this.view, a[0], a[1]);
        const [bx, by] = toScreen(this.view, b[0], b[1]);
        const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
        if (len2 === 0) continue;
        const t = ((px[0] - ax) * (bx - ax) + (px[1] - ay) * (by - ay)) / len2;
        if (t < 0.15 || t > 0.85) continue;
        const d = Math.hypot(px[0] - (ax + t * (bx - ax)), px[1] - (ay + t * (by - ay)));
        if (d < AXIS_HIT_PX) return [a, b];
      }
    }
    return null;
  }

  private pickAxisPoint(px: Vec2, snapped: Vec2): void {
    const edge = this.hitEdge(px);
    if (edge) {
      this.setAxis(axisThrough(edge[0], edge[1]));
      return;
    }
    const first = this.pickingAxis![0];
    if (first && (first[0] !== snapped[0] || first[1] !== snapped[1])) {
      this.setAxis(axisThrough(first, snapped));
      return;
    }
    this.pickingAxis = [snapped];
    this.callbacks.onMessage(EDITOR_MESSAGES.obliqueSecond);
    this.redraw();
  }

  private hitVertex(px: Vec2): { piece: number; index: number } | null {
    if (!this.figure || !this.editable) return null;
    for (let p = 0; p < this.figure.pieces.length; p++) {
      const ring = this.figure.pieces[p];
      for (let i = 0; i < ring.length; i++) {
        const [sx, sy] = toScreen(this.view, ring[i][0], ring[i][1]);
        if (Math.hypot(sx - px[0], sy - px[1]) < VERTEX_HIT_PX) return { piece: p, index: i };
      }
    }
    return null;
  }

  private onDown = (e: PointerEvent): void => {
    const { snapped, px } = this.pointerWorld(e);
    if (this.drawing) {
      this.addDrawingPoint(snapped);
      return;
    }
    if (this.pickingAxis) {
      this.pickAxisPoint(px, snapped);
      return;
    }
    const v = this.hitVertex(px);
    if (v && this.figure) {
      this.drag = { kind: 'vertex', ...v, original: this.figure.pieces[v.piece].map((q) => [...q] as Vec2) };
    } else if (this.axisDistancePx(px) < AXIS_HIT_PX) {
      this.drag = { kind: 'axis' };
    } else {
      return;
    }
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    const { snapped } = this.pointerWorld(e);
    if (this.drag.kind === 'axis') {
      const axis = this.axis;
      if (axis.dir === 'oblique') return;
      const pos = axis.dir === 'vertical' ? snapped[0] : snapped[1];
      if (pos === axis.pos) return;
      this.axis = { dir: axis.dir, pos };
      if (this.figure) this.figure = { ...this.figure, axis: this.axis };
      this.redraw();
      this.emit();
    } else if (this.figure) {
      const ring = this.figure.pieces[this.drag.piece];
      const cur = ring[this.drag.index];
      if (cur[0] === snapped[0] && cur[1] === snapped[1]) return;
      ring[this.drag.index] = snapped;
      this.redraw();
      if (validateRing(ring) === 'ok') this.emit();
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.drag) return;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (this.drag.kind === 'vertex' && this.figure) {
      const problem = validateRing(this.figure.pieces[this.drag.piece]);
      if (problem !== 'ok') {
        this.figure.pieces[this.drag.piece] = this.drag.original;
        this.callbacks.onMessage(EDITOR_MESSAGES[problem]);
        this.redraw();
        this.emit();
      }
    }
    this.drag = null;
  };

  private addDrawingPoint(p: Vec2): void {
    const pts = this.drawing!;
    const last = pts[pts.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    const first = pts[0];
    if (first && pts.length >= 3 && first[0] === p[0] && first[1] === p[1]) {
      const problem = validateRing(pts);
      if (problem !== 'ok') {
        this.callbacks.onMessage(EDITOR_MESSAGES[problem]);
        return;
      }
      this.figure = { pieces: [pts], axis: this.axis };
      this.drawing = null;
      this.callbacks.onMessage('');
      this.redraw();
      this.emit();
      return;
    }
    pts.push(p);
    this.redraw();
  }

  private redraw(): void {
    const { ctx, view } = this;
    if (view.width === 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawGrid(ctx, view);

    if (this.figure) {
      // 학생이 그린 도형만 그린다. (축 반대편으로 접은 모양을 겹쳐 그리면 그리지 않은 도형이 생긴 것처럼 보인다)
      drawRings(ctx, view, this.figure.pieces, COLORS_2D.figureFill, COLORS_2D.figureStroke);
      if (this.editable) {
        ctx.fillStyle = COLORS_2D.figureStroke;
        for (const ring of this.figure.pieces) for (const [x, y] of ring) {
          const [sx, sy] = toScreen(view, x, y);
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (this.drawing) {
      ctx.strokeStyle = COLORS_2D.figureStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.drawing.forEach(([x, y], i) => {
        const [sx, sy] = toScreen(view, x, y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      this.drawing.forEach(([x, y], i) => {
        const [sx, sy] = toScreen(view, x, y);
        ctx.fillStyle = i === 0 ? '#16a34a' : COLORS_2D.figureStroke;
        ctx.beginPath();
        ctx.arc(sx, sy, i === 0 ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 회전축 + 손잡이(세로·가로축은 끌어서 옮길 수 있음)
    ctx.save();
    ctx.strokeStyle = COLORS_2D.axis;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 5, 3, 5]);
    ctx.beginPath();
    const [[x1, y1], [x2, y2]] = axisScreenLine(view, this.axis);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    const handle = this.handlePosition();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS_2D.axis;
    ctx.beginPath();
    ctx.arc(handle[0], handle[1], 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('축', handle[0], handle[1]);
    if (this.pickingAxis?.[0]) {
      const [sx, sy] = toScreen(view, this.pickingAxis[0][0], this.pickingAxis[0][1]);
      ctx.fillStyle = COLORS_2D.axis;
      ctx.beginPath();
      ctx.arc(sx, sy, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** '축' 손잡이 위치: 축이 화면 안으로 들어오는 지점에서 18px 안쪽. */
  private handlePosition(): [number, number] {
    const { view } = this;
    const axis = this.axis;
    if (axis.dir === 'vertical') return [toScreen(view, axis.pos, 0)[0], 18];
    if (axis.dir === 'horizontal') return [view.width - 18, toScreen(view, 0, axis.pos)[1]];
    const [[x1, y1], [x2, y2]] = axisScreenLine(view, axis);
    // 화면 사각형 안에 들어오는 구간의 시작점(Liang–Barsky)
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    const sides: [number, number][] = [[-dx, x1], [dx, view.width - x1], [-dy, y1], [dy, view.height - y1]];
    for (const [p, q] of sides) {
      if (p === 0) continue;
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
    if (t0 > t1) return [18, 18];
    const inset = 18 / Math.hypot(dx, dy);
    return [x1 + dx * (t0 + inset), y1 + dy * (t0 + inset)];
  }
}
