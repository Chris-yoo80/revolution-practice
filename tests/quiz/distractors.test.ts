import { describe, expect, it } from 'vitest';
import { sameProfile } from '../../src/geometry/equality.ts';
import { figureInAxisFrame, halfProfile } from '../../src/geometry/profile.ts';
import type { Figure } from '../../src/geometry/types.ts';
import { alternativeAxes, figureCandidates, WHY } from '../../src/quiz/distractors.ts';

describe('alternativeAxes', () => {
  it('빗변이 축이면 두 직각변을 축으로 돌린 경우가 후보에 들어간다', () => {
    const fig: Figure = { pieces: [[[0, 0], [3, 0], [0, 4]]], axis: { dir: 'oblique', p: [3, 0], q: [0, 4] } };
    const profiles = alternativeAxes(fig).map((axis) => halfProfile({ pieces: fig.pieces, axis }));
    const aboutLegY = halfProfile({ pieces: fig.pieces, axis: { dir: 'vertical', pos: 0 } });
    const aboutLegX = halfProfile({ pieces: fig.pieces, axis: { dir: 'horizontal', pos: 0 } });
    expect(profiles.some((p) => sameProfile(p, aboutLegY))).toBe(true);
    expect(profiles.some((p) => sameProfile(p, aboutLegX))).toBe(true);
  });

  it('축 반대편(r < 0)에 있는 도형을 떨어뜨린 보기도 축을 가로지르지 않는다', () => {
    // 빗변 p→q 방향 기준으로 이 삼각형은 r < 0 쪽에 있다
    const fig: Figure = { pieces: [[[0, 0], [3, 0], [0, 4]]], axis: { dir: 'oblique', p: [3, 0], q: [0, 4] } };
    const away = figureCandidates(fig).filter((c) => c.why === WHY.figAway);
    expect(away.length).toBe(1);
    const v = away[0].visual;
    if (v.kind !== 'figure') throw new Error('figure 보기여야 함');
    const rs = figureInAxisFrame(v.figure).flat().map(([r]) => r);
    const allNeg = rs.every((r) => r <= -0.999);
    const allPos = rs.every((r) => r >= 0.999);
    expect(allNeg || allPos).toBe(true);
  });

  it('축이 도형을 가로지르면 떨어뜨리기·붙이기 보기를 만들지 않는다', () => {
    const fig: Figure = { pieces: [[[-1, 0], [2, 0], [2, 3], [-1, 3]]], axis: { dir: 'vertical', pos: 0 } };
    const shifted = figureCandidates(fig).filter((c) => c.why === WHY.figAway || c.why === WHY.figToward);
    expect(shifted).toHaveLength(0);
  });

  it('후보에 현재 축은 들어가지 않는다', () => {
    const fig: Figure = { pieces: [[[0, 0], [3, 0], [0, 4]]], axis: { dir: 'oblique', p: [3, 0], q: [0, 4] } };
    const current = halfProfile(fig);
    const profiles = alternativeAxes(fig).map((axis) => halfProfile({ pieces: fig.pieces, axis }));
    expect(profiles.some((p) => sameProfile(p, current))).toBe(false);
  });
});
