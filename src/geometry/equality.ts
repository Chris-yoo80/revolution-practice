import { bbox, mapPoints } from './polygon.ts';
import type { HalfProfile, MultiPolygon } from './types.ts';

export interface SameShapeOptions {
  /** x 방향 평행이동을 무시할지. 반쪽 단면은 r(축까지 거리)이 의미가 있으므로 false. */
  normalizeX: boolean;
  /** 위아래 뒤집기를 같은 모양으로 볼지. */
  allowFlipY: boolean;
}

const GRID = 64;
/** 표본점이 정수 좌표 경계선 위에 떨어지지 않도록 하는 작은 어긋남 */
const JITTER = 0.0137;

function normalize(mp: MultiPolygon, normalizeX: boolean): MultiPolygon {
  const b = bbox(mp);
  const dx = normalizeX ? b.minX : 0;
  return mapPoints(mp, ([x, y]) => [x - dx, y - b.minY]);
}

function flipY(mp: MultiPolygon): MultiPolygon {
  const b = bbox(mp);
  return mapPoints(mp, ([x, y]) => [x, b.maxY + b.minY - y]);
}

/** 스캔라인으로 GRID×GRID 표본 격자를 채운다(짝-홀 규칙). */
function rasterize(mp: MultiPolygon, minX: number, minY: number, step: number): Uint8Array {
  const cells = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    const y = minY + (j + 0.5 + JITTER) * step;
    const xs: number[] = [];
    for (const poly of mp) for (const ring of poly) {
      for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
        const [xi, yi] = ring[i];
        const [xk, yk] = ring[k];
        if (yi > y !== yk > y) xs.push(xi + ((y - yi) / (yk - yi)) * (xk - xi));
      }
    }
    xs.sort((p, q) => p - q);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const from = Math.max(0, Math.ceil((xs[m] - minX) / step - 0.5 - JITTER));
      const to = Math.min(GRID - 1, Math.floor((xs[m + 1] - minX) / step - 0.5 - JITTER));
      for (let i = from; i <= to; i++) cells[j * GRID + i] ^= 1;
    }
  }
  return cells;
}

/** 두 도형을 같은 격자 위에 찍어 보고, 안/밖이 다른 표본이 1% 이하이면 같다고 본다. */
function nearlyEqual(a: MultiPolygon, b: MultiPolygon): boolean {
  const ba = bbox(a);
  const bb = bbox(b);
  const minX = Math.min(ba.minX, bb.minX);
  const minY = Math.min(ba.minY, bb.minY);
  const size = Math.max(Math.max(ba.maxX, bb.maxX) - minX, Math.max(ba.maxY, bb.maxY) - minY);
  if (size === 0) return true;
  const step = size / GRID;
  const ra = rasterize(a, minX, minY, step);
  const rb = rasterize(b, minX, minY, step);
  let diff = 0;
  let inA = 0;
  let inB = 0;
  for (let i = 0; i < ra.length; i++) {
    inA += ra[i];
    inB += rb[i];
    if (ra[i] !== rb[i]) diff++;
  }
  return diff <= Math.max(inA, inB) * 0.01;
}

export function sameShape(a: MultiPolygon, b: MultiPolygon, opts: SameShapeOptions): boolean {
  if (a.length === 0 || b.length === 0) return a.length === b.length;
  const na = normalize(a, opts.normalizeX);
  const nb = normalize(b, opts.normalizeX);
  if (nearlyEqual(na, nb)) return true;
  return opts.allowFlipY && nearlyEqual(na, flipY(nb));
}

/** 두 반쪽 단면이 같은 회전체를 만드는지. 축 방향 평행이동·뒤집기는 같은 회전체로 본다. */
export function sameProfile(a: HalfProfile, b: HalfProfile): boolean {
  return sameShape(a, b, { normalizeX: false, allowFlipY: true });
}

/** 2D 단면 그림이 같은지. 위치는 무시하고 위아래 뒤집기는 같은 것으로 본다. */
export function sameSection(a: MultiPolygon, b: MultiPolygon): boolean {
  return sameShape(a, b, { normalizeX: true, allowFlipY: true });
}
