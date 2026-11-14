import { intersection, mapPoints, rect, ringsToMulti, union } from './polygon.ts';
import type { Axis, Figure, HalfProfile, MultiPolygon, Ring, Vec2 } from './types.ts';

const BIG = 1e4;

/** 축 위의 기준점 o, 축 방향 단위벡터 u, 축에 수직인 단위벡터 n. */
function axisFrame(axis: Axis): { o: Vec2; u: Vec2; n: Vec2 } {
  if (axis.dir !== 'oblique') {
    return axis.dir === 'vertical'
      ? { o: [axis.pos, 0], u: [0, 1], n: [1, 0] }
      : { o: [0, axis.pos], u: [1, 0], n: [0, 1] };
  }
  const dx = axis.q[0] - axis.p[0];
  const dy = axis.q[1] - axis.p[1];
  const len = Math.hypot(dx, dy);
  return { o: axis.p, u: [dx / len, dy / len], n: [dy / len, -dx / len] };
}

/** 모눈 좌표 → 축 좌표 [r(부호 있음), h]. r: 축까지의 거리, h: 축 방향 위치. */
export function toAxisPoint(p: Vec2, axis: Axis): Vec2 {
  const { o, u, n } = axisFrame(axis);
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  return [x * n[0] + y * n[1], x * u[0] + y * u[1]];
}

/** 축 좌표 → 모눈 좌표 (toAxisPoint의 역변환). */
export function fromAxisPoint(q: Vec2, axis: Axis): Vec2 {
  const { o, u, n } = axisFrame(axis);
  return [o[0] + q[0] * n[0] + q[1] * u[0], o[1] + q[0] * n[1] + q[1] * u[1]];
}

/** 두 점을 지나는 회전축. 세로·가로 방향이면 세로축·가로축으로 둔다. */
export function axisThrough(a: Vec2, b: Vec2): Axis {
  if (a[0] === b[0]) return { dir: 'vertical', pos: a[0] };
  if (a[1] === b[1]) return { dir: 'horizontal', pos: a[1] };
  return { dir: 'oblique', p: a, q: b };
}

/** 축 위의 서로 다른 두 점(그리기·범위 계산용). */
export function axisPoints(axis: Axis): [Vec2, Vec2] {
  if (axis.dir === 'oblique') return [axis.p, axis.q];
  return axis.dir === 'vertical' ? [[axis.pos, 0], [axis.pos, 1]] : [[0, axis.pos], [1, axis.pos]];
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
