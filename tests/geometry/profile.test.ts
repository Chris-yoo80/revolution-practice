import { describe, expect, it } from 'vitest';
import { bbox } from '../../src/geometry/polygon.ts';
import { halfProfile } from '../../src/geometry/profile.ts';
import { rectangle } from '../../src/geometry/shapes.ts';
import type { Axis } from '../../src/geometry/types.ts';

const vAxis: Axis = { dir: 'vertical', pos: 0 };

describe('halfProfile', () => {
  it('축에 붙은 직사각형은 그대로 반쪽 단면이 된다', () => {
    const hp = halfProfile({ pieces: [rectangle(0, 0, 3, 5)], axis: vAxis });
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 5 });
  });

  it('축이 가로지르면 더 넓은 쪽으로 접힌다', () => {
    const hp = halfProfile({ pieces: [rectangle(-1, 0, 3, 4)], axis: vAxis });
    expect(hp).toHaveLength(1);
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 4 });
  });

  it('축에서 떨어진 도형은 r 최솟값이 0보다 크다', () => {
    const hp = halfProfile({ pieces: [rectangle(2, 0, 1, 3)], axis: vAxis });
    expect(bbox(hp).minX).toBe(2);
  });

  it('가로축이면 y가 축까지 거리, x가 축 방향 위치가 된다', () => {
    const hp = halfProfile({ pieces: [rectangle(0, 0, 5, 2)], axis: { dir: 'horizontal', pos: 0 } });
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 5 });
  });

  it('축 왼쪽에만 있는 도형도 오른쪽으로 뒤집힌다', () => {
    const hp = halfProfile({ pieces: [rectangle(-3, 0, 3, 2)], axis: vAxis });
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 2 });
  });
});
