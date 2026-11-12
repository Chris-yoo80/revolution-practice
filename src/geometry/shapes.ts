import type { Figure, Ring, Vec2 } from './types.ts';

export function rectangle(x: number, y: number, w: number, h: number): Ring {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** 지름이 점 (cx, cy)를 지나는 반원. facing 쪽으로 볼록하다. */
export function semicircle(
  cx: number,
  cy: number,
  radius: number,
  facing: 'right' | 'left' | 'up' | 'down',
  segments = 32,
): Ring {
  const start = { right: -Math.PI / 2, up: 0, left: Math.PI / 2, down: Math.PI }[facing];
  const ring: Ring = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (i / segments) * Math.PI;
    ring.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

/** 꼭짓점 (cx, cy)에서 startAngle부터 90° 펼쳐진 사분원. */
export function quarterCircle(cx: number, cy: number, radius: number, startAngle: number, segments = 16): Ring {
  const ring: Ring = [[cx, cy]];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (i / segments) * (Math.PI / 2);
    ring.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

export function circle(cx: number, cy: number, radius: number, segments = 48): Ring {
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

export interface Preset {
  id: string;
  label: string;
  figure: Figure;
  /** 곡선 도형은 꼭짓점 편집을 막는다. */
  editable: boolean;
}

const vAxis = { dir: 'vertical' as const, pos: 0 };

export const PRESETS: Preset[] = [
  { id: 'rect', label: '직사각형', editable: true, figure: { pieces: [rectangle(0, 0, 3, 5)], axis: vAxis } },
  { id: 'tri', label: '직각삼각형', editable: true, figure: { pieces: [[[0, 0], [3, 0], [0, 5]]], axis: vAxis } },
  { id: 'trap', label: '사다리꼴', editable: true, figure: { pieces: [[[0, 0], [4, 0], [2, 4], [0, 4]]], axis: vAxis } },
  { id: 'semi', label: '반원', editable: false, figure: { pieces: [semicircle(0, 3, 3, 'right')], axis: vAxis } },
  { id: 'circle', label: '원 (축에서 떨어짐)', editable: false, figure: { pieces: [circle(3, 3, 1.5)], axis: vAxis } },
  {
    id: 'cyl-cone',
    label: '직사각형 + 삼각형',
    editable: true,
    figure: { pieces: [rectangle(0, 0, 3, 3), [[0, 3], [3, 3], [0, 6]]], axis: vAxis },
  },
  { id: 'off-rect', label: '축에서 떨어진 직사각형', editable: true, figure: { pieces: [rectangle(1, 0, 2, 4)], axis: vAxis } },
  {
    id: 'stairs',
    label: '계단 모양',
    editable: true,
    figure: { pieces: [rectangle(0, 0, 4, 2), rectangle(0, 2, 2, 3)], axis: vAxis },
  },
];
