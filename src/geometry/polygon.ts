import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon, Ring, Vec2 } from './types.ts';

/** polygon-clipping 결과의 닫는 점(첫 점 반복)을 제거한다. */
function openRing(ring: Vec2[]): Ring {
  const n = ring.length;
  if (n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) {
    return ring.slice(0, n - 1).map((p) => [p[0], p[1]] as Vec2);
  }
  return ring.map((p) => [p[0], p[1]] as Vec2);
}

function clean(mp: Vec2[][][]): MultiPolygon {
  return mp.map((poly) => poly.map(openRing));
}

/** 부동소수 오차로 polygon-clipping이 실패하지 않도록 좌표를 10⁻⁶ 단위로 맞춘다. */
function snap(mp: MultiPolygon): MultiPolygon {
  const q = (v: number) => Math.round(v * 1e6) / 1e6;
  return mp.map((poly) => poly.map((ring) => ring.map(([x, y]) => [q(x), q(y)] as Vec2)));
}

export function union(...geoms: MultiPolygon[]): MultiPolygon {
  const nonEmpty = geoms.filter((g) => g.length > 0).map(snap);
  if (nonEmpty.length === 0) return [];
  const [first, ...rest] = nonEmpty;
  return clean(polygonClipping.union(first, ...rest));
}

export function intersection(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (a.length === 0 || b.length === 0) return [];
  return clean(polygonClipping.intersection(snap(a), snap(b)));
}

export function ringsToMulti(rings: Ring[]): MultiPolygon {
  return rings.map((r) => [r]);
}

/** 부호 있는 넓이(반시계 +). */
export function signedArea(ring: Ring): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function polygonArea(poly: Polygon): number {
  const [outer, ...holes] = poly;
  return Math.abs(signedArea(outer)) - holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
}

export function multiArea(mp: MultiPolygon): number {
  return mp.reduce((s, p) => s + polygonArea(p), 0);
}

export function mapPoints(mp: MultiPolygon, f: (p: Vec2) => Vec2): MultiPolygon {
  return mp.map((poly) => poly.map((ring) => ring.map(f)));
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(mp: MultiPolygon): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** 축에 평행한 큰 직사각형. 접기·자르기에 사용. */
export function rect(minX: number, minY: number, maxX: number, maxY: number): MultiPolygon {
  return [[[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]]];
}
