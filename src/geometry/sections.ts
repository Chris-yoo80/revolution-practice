import { mapPoints, union } from './polygon.ts';
import type { HalfProfile, MultiPolygon, Ring, Vec2 } from './types.ts';

export interface Annulus {
  inner: number;
  outer: number;
}

/** 회전축을 포함하는 평면으로 자른 단면. 좌표 [x, h], x = ±r. */
export function axialSection(profile: HalfProfile): MultiPolygon {
  return union(profile, mapPoints(profile, ([r, h]) => [-r, h]));
}

const EPS = 1e-9;

/** 반쪽 단면이 높이 h에서 차지하는 r 구간들. 짝-홀 규칙으로 계산한다. */
export function intervalsAt(profile: HalfProfile, h: number): Annulus[] {
  const xs: number[] = [];
  for (const poly of profile) for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const [r1, h1] = ring[i];
      const [r2, h2] = ring[(i + 1) % ring.length];
      // 반개구간 규칙: 아래 끝점 포함, 위 끝점 제외 → 꼭짓점 중복 계산 방지
      if ((h1 <= h && h < h2) || (h2 <= h && h < h1)) {
        xs.push(r1 + ((h - h1) / (h2 - h1)) * (r2 - r1));
      }
    }
  }
  xs.sort((a, b) => a - b);
  const out: Annulus[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const inner = Math.abs(xs[i]) < EPS ? 0 : xs[i];
    const outer = xs[i + 1];
    const last = out[out.length - 1];
    if (last && Math.abs(last.outer - inner) < EPS) last.outer = outer;
    else out.push({ inner, outer });
  }
  return out;
}

/** 회전축에 수직인 평면(높이 h)으로 자른 단면의 원·고리 목록. */
export function perpendicularSection(profile: HalfProfile, h: number): Annulus[] {
  return intervalsAt(profile, h);
}

export function circleRing(radius: number, segments = 64): Ring {
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([radius * Math.cos(a), radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

/** 원·고리 목록을 2D 다각형(중심 원점)으로 바꾼다. 그리기·비교용. */
export function annuliToShape(annuli: Annulus[]): MultiPolygon {
  return annuli.map(({ inner, outer }) =>
    inner > 0 ? [circleRing(outer), circleRing(inner).reverse()] : [circleRing(outer)],
  );
}

/** 높이 h가 단면 계산에 안전하도록 꼭짓점 높이들 사이의 중간값 목록을 돌려준다. */
export function safeCutHeights(profile: HalfProfile): number[] {
  const hs = new Set<number>();
  for (const poly of profile) for (const ring of poly) for (const [, h] of ring) hs.add(h);
  const sorted = [...hs].sort((a, b) => a - b);
  const mids: number[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) mids.push((sorted[i] + sorted[i + 1]) / 2);
  return mids;
}
