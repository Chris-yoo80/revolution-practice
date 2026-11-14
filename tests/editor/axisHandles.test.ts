import { describe, expect, it } from 'vitest';
import { axisHandles } from '../../src/editor/axisHandles.ts';
import type { Vec2 } from '../../src/geometry/types.ts';

const bounds = { minX: -7, maxX: 7, minY: -2, maxY: 9 };
const sorted = (pts: Vec2[]) => [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe('axisHandles', () => {
  it('세로축은 화면 위아래 끝 근처의 모눈 점 두 개', () => {
    expect(sorted(axisHandles({ dir: 'vertical', pos: 0 }, bounds, []))).toEqual([[0, -1], [0, 8]]);
  });

  it('가로축은 화면 양옆 끝 근처의 모눈 점 두 개', () => {
    expect(sorted(axisHandles({ dir: 'horizontal', pos: 2 }, bounds, []))).toEqual([[-6, 2], [6, 2]]);
  });

  it('비스듬한 축은 그 직선 위의 모눈 점 중 가장 멀리 떨어진 두 점', () => {
    expect(sorted(axisHandles({ dir: 'oblique', p: [0, 0], q: [2, 1] }, bounds, []))).toEqual([[-2, -1], [6, 3]]);
  });

  it('두 점 사이가 여러 칸이어도 같은 직선이면 같은 손잡이', () => {
    expect(sorted(axisHandles({ dir: 'oblique', p: [0, 0], q: [4, 2] }, bounds, []))).toEqual([[-2, -1], [6, 3]]);
  });

  it('도형 꼭짓점과 겹치는 점은 되도록 피한다', () => {
    const avoid: Vec2[] = [[0, -1]];
    expect(sorted(axisHandles({ dir: 'vertical', pos: 0 }, bounds, avoid))).toEqual([[0, 0], [0, 8]]);
  });

  it('피할 수 없으면 꼭짓점 위에라도 둔다', () => {
    const avoid: Vec2[] = [[0, 0], [3, 0], [0, 4]];
    expect(sorted(axisHandles({ dir: 'oblique', p: [3, 0], q: [0, 4] }, bounds, avoid))).toEqual([[-3, 8], [3, 0]]);
  });
});
