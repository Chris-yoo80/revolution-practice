import type { Difficulty } from './figures.ts';
import { generateQuestion } from './generator.ts';
import { pick, type Rng } from './rng.ts';
import type { Question, QuizType } from './types.ts';

export type QuizMode = QuizType | 'all';

export interface SessionConfig {
  mode: QuizMode;
  difficulty: Difficulty;
  count: number;
}

export interface TypeStat {
  correct: number;
  total: number;
}

export interface SessionResult {
  score: number;
  total: number;
  byType: Record<QuizType, TypeStat>;
}

export class QuizSession {
  readonly config: SessionConfig;
  readonly questions: Question[];
  private answers: (number | null)[];
  private cursor = 0;

  constructor(config: SessionConfig, rng: Rng = Math.random) {
    this.config = config;
    const types: QuizType[] = ['A', 'B', 'C'];
    this.questions = Array.from({ length: config.count }, () =>
      generateQuestion(config.mode === 'all' ? pick(rng, types) : config.mode, config.difficulty, rng),
    );
    this.answers = this.questions.map(() => null);
  }

  get index(): number {
    return this.cursor;
  }

  get current(): Question {
    return this.questions[this.cursor];
  }

  get finished(): boolean {
    return this.cursor >= this.questions.length;
  }

  /** 현재 문제에 답한다. 이미 답했으면 처음 답을 유지한다. */
  answer(choiceIndex: number): boolean {
    if (this.answers[this.cursor] === null) this.answers[this.cursor] = choiceIndex;
    return this.answers[this.cursor] === this.current.answerIndex;
  }

  next(): void {
    this.cursor++;
  }

  result(): SessionResult {
    const byType: Record<QuizType, TypeStat> = {
      A: { correct: 0, total: 0 },
      B: { correct: 0, total: 0 },
      C: { correct: 0, total: 0 },
    };
    let score = 0;
    this.questions.forEach((q, i) => {
      const ok = this.answers[i] === q.answerIndex;
      byType[q.type].total++;
      if (ok) {
        byType[q.type].correct++;
        score++;
      }
    });
    return { score, total: this.questions.length, byType };
  }
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREFIX = 'revolution.best.';

export function bestKey(config: Pick<SessionConfig, 'mode' | 'difficulty'>): string {
  return `${PREFIX}${config.mode}-${config.difficulty}`;
}

export function loadBest(store: KeyValueStore, key: string): number | null {
  const raw = store.getItem(key);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 최고 기록이면 저장하고 true. */
export function saveBest(store: KeyValueStore, key: string, score: number): boolean {
  const prev = loadBest(store, key);
  if (prev !== null && prev >= score) return false;
  store.setItem(key, String(score));
  return true;
}
