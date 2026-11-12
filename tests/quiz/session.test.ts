import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/quiz/rng.ts';
import { bestKey, loadBest, QuizSession, saveBest } from '../../src/quiz/session.ts';

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('QuizSession', () => {
  it('정답 수와 유형별 통계를 센다', () => {
    const s = new QuizSession({ mode: 'all', difficulty: 'basic', count: 10 }, mulberry32(1));
    let i = 0;
    while (!s.finished) {
      const right = s.current.answerIndex;
      s.answer(i % 2 === 0 ? right : (right + 1) % 4);
      s.next();
      i++;
    }
    const r = s.result();
    expect(r.total).toBe(10);
    expect(r.score).toBe(5);
    expect(r.byType.A.total + r.byType.B.total + r.byType.C.total).toBe(10);
  });

  it('처음 고른 답만 인정한다', () => {
    const s = new QuizSession({ mode: 'A', difficulty: 'basic', count: 1 }, mulberry32(3));
    const wrong = (s.current.answerIndex + 1) % 4;
    expect(s.answer(wrong)).toBe(false);
    expect(s.answer(s.current.answerIndex)).toBe(false);
  });

  it('mode가 A면 모든 문제가 유형 A', () => {
    const s = new QuizSession({ mode: 'A', difficulty: 'advanced', count: 5 }, mulberry32(9));
    expect(s.questions.every((q) => q.type === 'A')).toBe(true);
  });
});

describe('최고 기록', () => {
  it('더 높은 점수만 저장한다', () => {
    const store = memoryStore();
    const key = bestKey({ mode: 'all', difficulty: 'basic' });
    expect(loadBest(store, key)).toBeNull();
    expect(saveBest(store, key, 5)).toBe(true);
    expect(saveBest(store, key, 3)).toBe(false);
    expect(saveBest(store, key, 7)).toBe(true);
    expect(loadBest(store, key)).toBe(7);
  });
});
