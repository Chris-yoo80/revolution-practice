import { intersection, mapPoints, rect, ringsToMulti, union } from './polygon.ts';
import type { Axis, Figure, HalfProfile, MultiPolygon, Ring, Vec2 } from './types.ts';

const BIG = 1e4;

/** 모눈 좌표 → 축 좌표 [r(부호 있음), h]. */
export function toAxisPoint(p: Vec2, axis: Axis): Vec2 {
  return axis.dir === 'vertical' ? [p[0] - axis.pos, p[1]] : [p[1] - axis.pos, p[0]];
}

/** 축 좌표 → 모눈 좌표 (toAxisPoint의 역변환). */
export function fromAxisPoint(q: Vec2, axis: Axis): Vec2 {
  return axis.dir === 'vertical' ? [q[0] + axis.pos, q[1]] : [q[1], q[0] + axis.pos];
}

/** 도형 조각들을 축 좌표로 바꾼 고리 목록(접기 전, r이 음수일 수 있음). */
export function figureInAxisFrame(figure: Figure): Ring[] {
  return figure.pieces.map((ring) => ring.map((p) => toAxisPoint(p, figure.axis)));
}

/** 축 좌표 다각형을 축(r = 0) 기준으로 접어 반쪽 단면을 만든다. */
export function foldToHalf(shape: MultiPolygon): HalfProfile {
  const merged = union(shape);
  const pos = intersection(merged, rect(0, -BIG, BIG, BIG));
  const neg = intersection(merged, rect(-BIG, -BIG, 0, BIG));
  const negFlipped = mapPoints(neg, ([r, h]) => [Math.abs(r), h]); // abs: -0 대신 0
  return union(pos, negFlipped);
}

export function halfProfile(figure: Figure): HalfProfile {
  return foldToHalf(ringsToMulti(figureInAxisFrame(figure)));
}
