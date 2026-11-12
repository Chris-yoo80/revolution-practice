import { describe, expect, it } from 'vitest';
import { sameProfile, sameSection } from '../../src/geometry/equality.ts';
import { halfProfile } from '../../src/geometry/profile.ts';
import type { MultiPolygon } from '../../src/geometry/types.ts';
import type { Difficulty } from '../../src/quiz/figures.ts';
import { generateQuestion } from '../../src/quiz/generator.ts';
import { mulberry32 } from '../../src/quiz/rng.ts';
import type { Choice, QuizType } from '../../src/quiz/types.ts';

function key(c: Choice): MultiPolygon | null {
  const v = c.visual;
  if (v.kind === 'solid') return v.profile;
  if (v.kind === 'figure') return halfProfile(v.figure);
  if (v.kind === 'section') return v.shape;
  return null;
}

const cases: [QuizType, Difficulty][] = [
  ['A', 'basic'], ['A', 'advanced'],
  ['B', 'basic'], ['B', 'advanced'],
  ['C', 'basic'], ['C', 'advanced'],
];

describe('generateQuestion', () => {
  it.each(cases)('유형 %s / %s: 보기 4개, 정답 1개, 서로 다른 보기', (type, difficulty) => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 150; i++) {
      const q = generateQuestion(type, difficulty, rng);
      expect(q.choices).toHaveLength(4);
      expect(q.choices[q.answerIndex].why).toBe('');
      q.choices.forEach((c, j) => {
        if (j !== q.answerIndex) expect(c.why).not.toBe('');
      });
      expect(q.choices.filter((c) => c.visual.kind === 'prism').length).toBeLessThanOrEqual(1);
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        const ka = key(q.choices[a]);
        const kb = key(q.choices[b]);
        if (!ka || !kb) continue;
        expect(type === 'C' ? sameSection(ka, kb) : sameProfile(ka, kb)).toBe(false);
      }
    }
  }, 60_000);

  it('같은 시드면 같은 문제', () => {
    const a = generateQuestion('A', 'basic', mulberry32(7));
    const b = generateQuestion('A', 'basic', mulberry32(7));
    expect(a).toEqual(b);
  });
});
