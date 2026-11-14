import { axisThrough } from '../geometry/profile.ts';
import type { Axis, AxisDir, Figure, Ring, Vec2 } from '../geometry/types.ts';
import { validateRing } from '../geometry/validate.ts';
import { axisScreenLine, COLORS_2D, drawGrid, drawRings, toScreen, toWorld, type View } from '../render/draw2d.ts';
import { axisHandles } from './axisHandles.ts';

/** 모눈 작업판이 보여주는 세계 좌표 범위 (아래쪽에 축 손잡이 둘 자리를 한 칸 더 둔다) */
const WORLD = { minX: -7, maxX: 7, minY: -2, maxY: 9 };
const HANDLE_HIT_PX = 26;
const VERTEX_HIT_PX = 24;
const LINE_HIT_PX = 20;
const EDGE_HIT_PX = 18;
const TAP_SLOP_PX = 8;

export const EDITOR_MESSAGES = {
  'too-few': '점을 3개 이상 찍어야 도형이 돼요.',
  'zero-area': '넓이가 없는 도형은 돌릴 수 없어요.',
  'self-intersect': '변끼리 겹치지 않게 그려 주세요.',
  drawHint: '모눈의 점을 차례로 눌러 도형을 그리고, 첫 점을 다시 누르면 완성돼요.',
} as const;

/** 모눈 아래에 늘 보여줄 축 조작 안내 (앞에 빨간 손잡이 그림이 붙는다) */
export const AXIS_HINT = '손잡이를 끌면 축이 기울어지고, 축 선을 끌면 옮겨져요. 도형의 변을 누르면 그 변이 축이 돼요.';

export interface GridEditorCallbacks {
  onChange(figure: Figure | null): void;
  onMessage(message: string): void;
}

type Drag =
  | { kind: 'handle'; index: 0 | 1 }
  | { kind: 'line'; start: Vec2; original: [Vec2, Vec2] }
  | { kind: 'vertex'; piece: number; index: number; original: Ring }
  | { kind: 'edge-tap'; edge: [Vec2, Vec2]; startPx: Vec2 }
  | null;

const samePoint = (a: Vec2, b: Vec2) => a[0] === b[0] && a[1] === b[1];

/** 손잡이가 화면 가장자리에 걸리지 않도록 안쪽 범위로 제한한다. */
function insideWorld([x, y]: Vec2): boolean {
  return x > WORLD.minX && x < WORLD.maxX && y > WORLD.minY && y < WORLD.maxY;
}

/** 화면 점 p에서 선분 ab까지의 거리와 선분 위 위치 t(0~1). */
function segmentDistance(p: Vec2, a: Vec2, b: Vec2): { d: number; t: number } {
  const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  if (len2 === 0) return { d: Math.hypot(p[0] - a[0], p[1] - a[1]), t: 0 };
  const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / len2;
  return { d: Math.hypot(p[0] - (a[0] + t * (b[0] - a[0])), p[1] - (a[1] + t * (b[1] - a[1]))), t };
}

export class GridEditor {
  private ctx: CanvasRenderingContext2D;
  private view: View = { cx: 0, cy: 4, scale: 40, width: 0, height: 0 };
  private dpr = 1;
  private figure: Figure | null = null;
  private axis: Axis = { dir: 'vertical', pos: 0 };
  /** 축을 끄는 손잡이 두 개(모눈 점). 축은 늘 이 두 점을 지난다. */
  private handles: [Vec2, Vec2] = [[0, -1], [0, 8]];
  private editable = false;
  private drawing: Vec2[] | null = null;
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
    this.placeHandles();
    this.resize();
  }

  get currentAxis(): Axis {
    return this.axis;
  }

  setFigure(figure: Figure | null, editable: boolean): void {
    this.figure = figure ? { pieces: figure.pieces.map((r) => r.map((p) => [...p] as Vec2)), axis: figure.axis } : null;
    if (figure) this.axis = { ...figure.axis };
    this.editable = editable;
    this.drawing = null;
    this.placeHandles();
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

  /** '세로축'·'가로축' 버튼: 원점을 지나는 세로·가로축으로 되돌린다. */
  setAxisPreset(dir: AxisDir): void {
    this.setAxis({ dir, pos: 0 });
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  private setAxis(axis: Axis): void {
    this.axis = axis;
    this.placeHandles();
    this.applyAxis();
  }

  /** 현재 축에 맞춰 손잡이를 도형 꼭짓점을 피해 다시 놓는다. */
  private placeHandles(): void {
    const vertices = this.figure ? this.figure.pieces.flat() : [];
    this.handles = axisHandles(this.axis, WORLD, vertices);
  }

  private applyAxis(): void {
    if (this.figure) this.figure = { ...this.figure, axis: this.axis };
    this.callbacks.onMessage('');
    this.redraw();
    this.emit();
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

  private pointerWorld(e: PointerEvent): { snapped: Vec2; px: Vec2 } {
    const rect = this.canvas.getBoundingClientRect();
    const px: Vec2 = [e.clientX - rect.left, e.clientY - rect.top];
    const world = toWorld(this.view, px[0], px[1]);
    const snapped: Vec2 = [
      Math.min(WORLD.maxX, Math.max(WORLD.minX, Math.round(world[0]))),
      Math.min(WORLD.maxY, Math.max(WORLD.minY, Math.round(world[1]))),
    ];
    return { snapped, px };
  }

  private screen(p: Vec2): Vec2 {
    return toScreen(this.view, p[0], p[1]) as Vec2;
  }

  private hitHandle(px: Vec2): 0 | 1 | null {
    for (const i of [0, 1] as const) {
      const [sx, sy] = this.screen(this.handles[i]);
      if (Math.hypot(sx - px[0], sy - px[1]) < HANDLE_HIT_PX) return i;
    }
    return null;
  }

  private hitVertex(px: Vec2): { piece: number; index: number } | null {
    if (!this.figure || !this.editable) return null;
    for (let p = 0; p < this.figure.pieces.length; p++) {
      const ring = this.figure.pieces[p];
      for (let i = 0; i < ring.length; i++) {
        const [sx, sy] = this.screen(ring[i]);
        if (Math.hypot(sx - px[0], sy - px[1]) < VERTEX_HIT_PX) return { piece: p, index: i };
      }
    }
    return null;
  }

  private hitAxisLine(px: Vec2): boolean {
    const [a, b] = axisScreenLine(this.view, this.axis) as [Vec2, Vec2];
    return segmentDistance(px, a, b).d < LINE_HIT_PX;
  }

  /** 화면 점 px 근처(양 끝 제외)에 있는 도형의 변. */
  private hitEdge(px: Vec2): [Vec2, Vec2] | null {
    if (!this.figure) return null;
    for (const ring of this.figure.pieces) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const { d, t } = segmentDistance(px, this.screen(a), this.screen(b));
        if (t > 0.15 && t < 0.85 && d < EDGE_HIT_PX) return [a, b];
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
    const handle = this.hitHandle(px);
    const vertex = handle === null ? this.hitVertex(px) : null;
    const edge = handle === null && !vertex && !this.hitAxisLine(px) ? this.hitEdge(px) : null;
    if (handle !== null) {
      this.drag = { kind: 'handle', index: handle };
    } else if (vertex && this.figure) {
      this.drag = { kind: 'vertex', ...vertex, original: this.figure.pieces[vertex.piece].map((q) => [...q] as Vec2) };
    } else if (this.hitAxisLine(px)) {
      this.drag = { kind: 'line', start: snapped, original: [[...this.handles[0]], [...this.handles[1]]] };
    } else if (edge) {
      this.drag = { kind: 'edge-tap', edge, startPx: px };
    } else {
      return;
    }
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    const { snapped, px } = this.pointerWorld(e);
    if (!this.drag) {
      // 마우스로 쓸 때 끌 수 있는 곳에서 손 모양 커서
      this.canvas.style.cursor = this.hitHandle(px) !== null || this.hitAxisLine(px) ? 'grab' : '';
      return;
    }
    const drag = this.drag;
    if (drag.kind === 'handle') {
      const other = this.handles[1 - drag.index];
      if (!insideWorld(snapped) || samePoint(snapped, other) || samePoint(snapped, this.handles[drag.index])) return;
      this.handles[drag.index] = snapped;
      this.axis = axisThrough(this.handles[0], this.handles[1]);
      this.applyAxis();
    } else if (drag.kind === 'line') {
      const dx = snapped[0] - drag.start[0];
      const dy = snapped[1] - drag.start[1];
      const moved = drag.original.map(([x, y]) => [x + dx, y + dy] as Vec2) as [Vec2, Vec2];
      if (!moved.every(insideWorld) || moved.every((m, i) => samePoint(m, this.handles[i]))) return;
      this.handles = moved;
      this.axis = axisThrough(moved[0], moved[1]);
      this.applyAxis();
    } else if (drag.kind === 'vertex' && this.figure) {
      const ring = this.figure.pieces[drag.piece];
      if (samePoint(ring[drag.index], snapped)) return;
      ring[drag.index] = snapped;
      this.redraw();
      if (validateRing(ring) === 'ok') this.emit();
    }
  };

  private onUp = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.drag = null;
    if (drag.kind === 'vertex' && this.figure) {
      const problem = validateRing(this.figure.pieces[drag.piece]);
      if (problem !== 'ok') {
        this.figure.pieces[drag.piece] = drag.original;
        this.callbacks.onMessage(EDITOR_MESSAGES[problem]);
        this.redraw();
        this.emit();
      }
    } else if (drag.kind === 'edge-tap') {
      const { px } = this.pointerWorld(e);
      if (Math.hypot(px[0] - drag.startPx[0], px[1] - drag.startPx[1]) < TAP_SLOP_PX) {
        this.setAxis(axisThrough(drag.edge[0], drag.edge[1]));
      }
    }
  };

  private addDrawingPoint(p: Vec2): void {
    const pts = this.drawing!;
    const last = pts[pts.length - 1];
    if (last && samePoint(last, p)) return;
    const first = pts[0];
    if (first && pts.length >= 3 && samePoint(first, p)) {
      const problem = validateRing(pts);
      if (problem !== 'ok') {
        this.callbacks.onMessage(EDITOR_MESSAGES[problem]);
        return;
      }
      this.figure = { pieces: [pts], axis: this.axis };
      this.drawing = null;
      this.placeHandles();
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
        for (const ring of this.figure.pieces) for (const pt of ring) {
          const [sx, sy] = this.screen(pt);
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
      this.drawing.forEach((pt, i) => {
        const [sx, sy] = this.screen(pt);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      this.drawing.forEach((pt, i) => {
        const [sx, sy] = this.screen(pt);
        ctx.fillStyle = i === 0 ? '#16a34a' : COLORS_2D.figureStroke;
        ctx.beginPath();
        ctx.arc(sx, sy, i === 0 ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 회전축 + 끌기 손잡이 두 개
    ctx.save();
    ctx.strokeStyle = COLORS_2D.axis;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 5, 3, 5]);
    ctx.beginPath();
    const [[x1, y1], [x2, y2]] = axisScreenLine(view, this.axis);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const hpt of this.handles) {
      const [sx, sy] = this.screen(hpt);
      ctx.beginPath();
      ctx.arc(sx, sy, 13, 0, Math.PI * 2);
      ctx.fillStyle = COLORS_2D.axis;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    ctx.restore();
  }
}
