import { bbox, ringsToMulti } from '../geometry/polygon.ts';
import { axisPoints } from '../geometry/profile.ts';
import type { Axis, Figure, MultiPolygon, Ring } from '../geometry/types.ts';

export const COLORS_2D = {
  bg: '#ffffff',
  grid: '#e3e7f0',
  gridStrong: '#c5ccdb',
  figureFill: 'rgba(255, 138, 61, 0.45)',
  figureStroke: '#e8681a',
  sectionFill: 'rgba(245, 158, 11, 0.75)',
  sectionStroke: '#b45309',
  axis: '#e5484d',
};

/** 화면 좌표 변환: 세계 좌표 중심(cx, cy)을 캔버스 가운데에 두고 1단위 = scale px. y는 위로. */
export interface View {
  cx: number;
  cy: number;
  scale: number;
  width: number;
  height: number;
}

export function toScreen(v: View, x: number, y: number): [number, number] {
  return [v.width / 2 + (x - v.cx) * v.scale, v.height / 2 - (y - v.cy) * v.scale];
}

export function toWorld(v: View, px: number, py: number): [number, number] {
  return [v.cx + (px - v.width / 2) / v.scale, v.cy - (py - v.height / 2) / v.scale];
}

export function drawGrid(ctx: CanvasRenderingContext2D, v: View): void {
  ctx.fillStyle = COLORS_2D.bg;
  ctx.fillRect(0, 0, v.width, v.height);
  const [x0, y1] = toWorld(v, 0, 0);
  const [x1, y0] = toWorld(v, v.width, v.height);
  ctx.lineWidth = 1;
  for (let x = Math.ceil(x0); x <= x1; x++) {
    ctx.strokeStyle = x === 0 ? COLORS_2D.gridStrong : COLORS_2D.grid;
    const [px] = toScreen(v, x, 0);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, v.height);
    ctx.stroke();
  }
  for (let y = Math.ceil(y0); y <= y1; y++) {
    ctx.strokeStyle = y === 0 ? COLORS_2D.gridStrong : COLORS_2D.grid;
    const [, py] = toScreen(v, 0, y);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(v.width, py);
    ctx.stroke();
  }
}

function tracePath(ctx: CanvasRenderingContext2D, v: View, rings: Ring[]): void {
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach(([x, y], i) => {
      const [px, py] = toScreen(v, x, y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
}

export function drawRings(ctx: CanvasRenderingContext2D, v: View, rings: Ring[], fill: string, stroke: string): void {
  tracePath(ctx, v, rings);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** 축을 화면 끝에서 끝까지 이어지는 직선으로 그릴 두 화면 점. */
export function axisScreenLine(v: View, axis: Axis): [[number, number], [number, number]] {
  const [a, b] = axisPoints(axis);
  const [ax, ay] = toScreen(v, a[0], a[1]);
  const [bx, by] = toScreen(v, b[0], b[1]);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const far = (v.width + v.height) * 2;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  return [[ax - ux * far, ay - uy * far], [ax + ux * far, ay + uy * far]];
}

export function drawAxis(ctx: CanvasRenderingContext2D, v: View, figure: Figure): void {
  const [[x1, y1], [x2, y2]] = axisScreenLine(v, figure.axis);
  ctx.save();
  ctx.strokeStyle = COLORS_2D.axis;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 4, 2, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** 도형과 (세로·가로축이면 축 위치, 비스듬한 축이면 축을 정한 두 점)을 담는 범위. */
function figureBounds(figure: Figure): { minX: number; minY: number; maxX: number; maxY: number } {
  const b = bbox(ringsToMulti(figure.pieces));
  const ax = figure.axis;
  if (ax.dir === 'oblique') {
    const xs = [b.minX, b.maxX, ax.p[0], ax.q[0]];
    const ys = [b.minY, b.maxY, ax.p[1], ax.q[1]];
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }
  return {
    minX: ax.dir === 'vertical' ? Math.min(b.minX, ax.pos) : b.minX,
    maxX: ax.dir === 'vertical' ? Math.max(b.maxX, ax.pos) : b.maxX,
    minY: ax.dir === 'horizontal' ? Math.min(b.minY, ax.pos) : b.minY,
    maxY: ax.dir === 'horizontal' ? Math.max(b.maxY, ax.pos) : b.maxY,
  };
}

/** 도형 + 축 범위를 담는 세계 좌표 크기(가로·세로 중 큰 값). 보기들의 축척을 맞출 때 쓴다. */
export function figureExtent(figure: Figure): number {
  const b = figureBounds(figure);
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

export function sectionExtent(shape: MultiPolygon): number {
  const b = bbox(shape);
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

/** 도형+축 그림을 캔버스에 그린다. unitsAcross: 캔버스 짧은 변에 들어갈 세계 단위 수. */
export function paintFigure(canvas: HTMLCanvasElement, figure: Figure, unitsAcross: number): void {
  const ctx = canvas.getContext('2d')!;
  const { minX, minY, maxX, maxY } = figureBounds(figure);
  const v: View = {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    scale: Math.min(canvas.width, canvas.height) / unitsAcross,
    width: canvas.width,
    height: canvas.height,
  };
  drawGrid(ctx, v);
  drawRings(ctx, v, figure.pieces, COLORS_2D.figureFill, COLORS_2D.figureStroke);
  drawAxis(ctx, v, figure);
}

/** 단면 그림을 가운데에 그린다. */
export function paintSection(canvas: HTMLCanvasElement, shape: MultiPolygon, unitsAcross: number): void {
  const ctx = canvas.getContext('2d')!;
  const b = bbox(shape);
  const v: View = {
    cx: (b.minX + b.maxX) / 2,
    cy: (b.minY + b.maxY) / 2,
    scale: Math.min(canvas.width, canvas.height) / unitsAcross,
    width: canvas.width,
    height: canvas.height,
  };
  drawGrid(ctx, v);
  drawRings(ctx, v, shape.flat(), COLORS_2D.sectionFill, COLORS_2D.sectionStroke);
}

function offscreen(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

export function figureImage(figure: Figure, unitsAcross: number, size = 240): string {
  const c = offscreen(size);
  paintFigure(c, figure, unitsAcross);
  return c.toDataURL();
}

export function sectionImage(shape: MultiPolygon, unitsAcross: number, size = 240): string {
  const c = offscreen(size);
  paintSection(c, shape, unitsAcross);
  return c.toDataURL();
}
