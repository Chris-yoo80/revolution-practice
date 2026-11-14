import { axisPoints } from '../geometry/profile.ts';
import type { Axis, Vec2 } from '../geometry/types.ts';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** 손잡이를 화면 가장자리에서 띄워 둘 여유(모눈 칸) */
const MARGIN = 0.5;

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * 축을 끌기 위한 손잡이 두 개: 축 위의 모눈 점 중 화면 안에서 가장 멀리 떨어진 두 점.
 * 도형 꼭짓점(avoid)과 겹치는 점은 되도록 피한다(꼭짓점 끌기와 헷갈리지 않게).
 * 축은 모눈 점을 지난다고 가정한다(세로·가로축 위치, 비스듬한 축의 두 점이 모두 정수).
 */
export function axisHandles(axis: Axis, bounds: Bounds, avoid: Vec2[]): [Vec2, Vec2] {
  const [p0, q0] = axisPoints(axis);
  const p: Vec2 = [Math.round(p0[0]), Math.round(p0[1])];
  let dx = Math.round(q0[0]) - p[0];
  let dy = Math.round(q0[1]) - p[1];
  const g = gcd(dx, dy) || 1;
  dx /= g;
  dy /= g;

  const inside = ([x, y]: Vec2) =>
    x >= bounds.minX + MARGIN && x <= bounds.maxX - MARGIN && y >= bounds.minY + MARGIN && y <= bounds.maxY - MARGIN;
  const span = Math.ceil(Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)) + 1;
  const all: Vec2[] = [];
  for (let k = -span; k <= span; k++) {
    const pt: Vec2 = [p[0] + k * dx, p[1] + k * dy];
    if (inside(pt)) all.push(pt);
  }
  const free = all.filter((pt) => !avoid.some((a) => a[0] === pt[0] && a[1] === pt[1]));
  const pts = free.length >= 2 ? free : all;
  if (pts.length >= 2) return [pts[0], pts[pts.length - 1]];
  // 화면 안에 모눈 점이 하나 이하면 축을 정한 두 점을 그대로 쓴다
  return [p, [p[0] + dx, p[1] + dy]];
}
