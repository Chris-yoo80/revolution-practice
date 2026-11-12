import { describe, expect, it } from 'vitest';
import { randomFigure } from '../../src/quiz/figures.ts';
import { mulberry32 } from '../../src/quiz/rng.ts';
import type { Ring } from '../../src/geometry/types.ts';

/** 가로·세로가 아닌(기울어진) 변이 있는지 */
function hasSlantedEdge(ring: Ring): boolean {
  return ring.some(([x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length];
    return x1 !== x2 && y1 !== y2;
  });
}

describe('randomFigure', () => {
  it('심화 도형은 모두 기울어진 변을 가진다', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 300; i++) {
      const f = randomFigure('hard', rng);
      expect(f.pieces.some(hasSlantedEdge)).toBe(true);
    }
  });

  it('심화 도형 가운데 축에 변이 붙지 않은 도형도 나온다', () => {
    const rng = mulberry32(12);
    let detached = 0;
    for (let i = 0; i < 200; i++) {
      const f = randomFigure('hard', rng);
      const coord = f.axis.dir === 'vertical' ? 0 : 1;
      const onAxis = f.pieces.some((ring) =>
        ring.some((p, j) => p[coord] === f.axis.pos && ring[(j + 1) % ring.length][coord] === f.axis.pos),
      );
      if (!onAxis) detached++;
    }
    expect(detached).toBeGreaterThan(40);
  });
});
