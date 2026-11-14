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

  it('심화 도형 가운데 비스듬한 축도 나온다', () => {
    const rng = mulberry32(13);
    let oblique = 0;
    for (let i = 0; i < 300; i++) {
      if (randomFigure('hard', rng).axis.dir === 'oblique') oblique++;
    }
    expect(oblique).toBeGreaterThan(30);
  });

  it('심화 도형 가운데 축에 변이 붙지 않은 도형도 나온다', () => {
    const rng = mulberry32(12);
    let detached = 0;
    for (let i = 0; i < 200; i++) {
      const f = randomFigure('hard', rng);
      const axis = f.axis;
      if (axis.dir === 'oblique') continue;
      const coord = axis.dir === 'vertical' ? 0 : 1;
      const pos = axis.pos;
      const onAxis = f.pieces.some((ring) =>
        ring.some((p, j) => p[coord] === pos && ring[(j + 1) % ring.length][coord] === pos),
      );
      if (!onAxis) detached++;
    }
    expect(detached).toBeGreaterThan(40);
  });
});
