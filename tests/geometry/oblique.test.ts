import { describe, expect, it } from 'vitest';
import { classify } from '../../src/geometry/classify.ts';
import { sameProfile } from '../../src/geometry/equality.ts';
import { bbox } from '../../src/geometry/polygon.ts';
import { fromAxisPoint, halfProfile, toAxisPoint } from '../../src/geometry/profile.ts';
import { rectangle } from '../../src/geometry/shapes.ts';
import type { Axis, Ring } from '../../src/geometry/types.ts';

const hypotenuse: Axis = { dir: 'oblique', p: [3, 0], q: [0, 4] };
const rightTriangle: Ring = [[0, 0], [3, 0], [0, 4]];

describe('비스듬한 회전축', () => {
  it('축 좌표로 바꿨다가 되돌리면 원래 점', () => {
    for (const pt of [[0, 0], [2, 5], [-1, 3]] as [number, number][]) {
      const back = fromAxisPoint(toAxisPoint(pt, hypotenuse), hypotenuse);
      expect(back[0]).toBeCloseTo(pt[0], 9);
      expect(back[1]).toBeCloseTo(pt[1], 9);
    }
  });

  it('축 위의 점은 축까지 거리가 0', () => {
    expect(toAxisPoint([1.5, 2], hypotenuse)[0]).toBeCloseTo(0, 9);
  });

  it('직각삼각형을 빗변을 축으로 돌리면 원뿔 두 개, 반지름은 높이 12/5', () => {
    const hp = halfProfile({ pieces: [rightTriangle], axis: hypotenuse });
    expect(classify(hp).name).toBe('원뿔 + 원뿔');
    const b = bbox(hp);
    expect(b.minX).toBeCloseTo(0, 6);
    expect(b.maxX).toBeCloseTo(12 / 5, 6);
    expect(b.maxY - b.minY).toBeCloseTo(5, 6);
  });

  it('세로선과 같은 방향의 비스듬한 축은 세로축과 같은 회전체', () => {
    const fig = [rectangle(0, 0, 3, 4)];
    const oblique = halfProfile({ pieces: fig, axis: { dir: 'oblique', p: [0, 0], q: [0, 7] } });
    const vertical = halfProfile({ pieces: fig, axis: { dir: 'vertical', pos: 0 } });
    expect(sameProfile(oblique, vertical)).toBe(true);
  });
});
