import { fromAxisPoint, halfProfile } from '../geometry/profile.ts';
import type { Axis, AxisDir, Figure, Ring, Vec2 } from '../geometry/types.ts';
import { validateRing } from '../geometry/validate.ts';
import { COLORS_2D, drawGrid, drawRings, toScreen, toWorld, type View } from '../render/draw2d.ts';

/** 모눈 작업판이 보여주는 세계 좌표 범위 */
const WORLD = { minX: -7, maxX: 7, minY: -1, maxY: 9 };
const VERTEX_HIT_PX = 24;
const AXIS_HIT_PX = 18;

export const EDITOR_MESSAGES = {
  'too-few': '점을 3개 이상 찍어야 도형이 돼요.',
  'zero-area': '넓이가 없는 도형은 돌릴 수 없어요.',
  'self-intersect': '변끼리 겹치지 않게 그려 주세요.',
  drawHint: '모눈의 점을 차례로 눌러 도형을 그리고, 첫 점을 다시 누르면 완성돼요.',
} as const;

export interface GridEditorCallbacks {
  onChange(figure: Figure | null): void;
  onMessage(message: string): void;
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
    if (figure) this.axis = { ...figure.axis };
    this.editable = editable;
    this.drawing = null;
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

  setAxisDir(dir: AxisDir): void {
    this.axis = { dir, pos: 0 };
    if (this.figure) this.figure = { ...this.figure, axis: this.axis };
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

  private axisDistancePx(px: Vec2): number {
    const [ax, ay] = toScreen(this.view, this.axis.pos, this.axis.pos);
    return this.axis.dir === 'vertical' ? Math.abs(px[0] - ax) : Math.abs(px[1] - ay);
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
      const pos = this.axis.dir === 'vertical' ? snapped[0] : snapped[1];
      if (pos === this.axis.pos) return;
      this.axis = { ...this.axis, pos };
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
      // 접힌 반쪽 단면(실제로 회전체를 결정하는 부분)을 옅게 먼저 그린다
      const half = halfProfile({ pieces: this.figure.pieces, axis: this.axis });
      const halfRings = half.flat().map((ring) => ring.map((q) => fromAxisPoint(q, this.axis)));
      drawRings(ctx, view, halfRings, 'rgba(124, 92, 255, 0.18)', 'rgba(124, 92, 255, 0.5)');
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

    // 회전축 + 끌기 손잡이
    ctx.save();
    ctx.strokeStyle = COLORS_2D.axis;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 5, 3, 5]);
    ctx.beginPath();
    let handle: [number, number];
    if (this.axis.dir === 'vertical') {
      const [sx] = toScreen(view, this.axis.pos, 0);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, view.height);
      handle = [sx, 18];
    } else {
      const [, sy] = toScreen(view, 0, this.axis.pos);
      ctx.moveTo(0, sy);
      ctx.lineTo(view.width, sy);
      handle = [view.width - 18, sy];
    }
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
    ctx.restore();
  }
}
