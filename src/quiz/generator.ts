import { sameProfile, sameSection } from '../geometry/equality.ts';
import { halfProfile } from '../geometry/profile.ts';
import { safeCutHeights } from '../geometry/sections.ts';
import type { Figure, HalfProfile, MultiPolygon } from '../geometry/types.ts';
import {
  figureCandidates,
  fillerChoice,
  sectionCandidates,
  sectionOf,
  solidCandidates,
} from './distractors.ts';
import { randomFigure, type Difficulty } from './figures.ts';
import { pick, shuffle, type Rng } from './rng.ts';
import type { Choice, Cut, Question, QuizType } from './types.ts';

export const PROMPTS = {
  A: '이 평면도형을 회전축 둘레로 한 바퀴 돌리면 어떤 회전체가 될까요?',
  B: '이 회전체는 어떤 평면도형을 회전축 둘레로 돌려서 만든 것일까요?',
  Caxial: '이 회전체를 회전축을 포함하는 평면으로 자르면 단면은 어떤 모양일까요?',
  Cperp: '이 회전체를 회전축에 수직인 평면으로 자르면 단면은 어떤 모양일까요?',
};

const keyCache = new WeakMap<Choice, HalfProfile | MultiPolygon | null>();

/** 보기를 비교할 때 쓰는 모양. 각기둥(prism)은 회전체가 아니므로 null. */
function compareKey(choice: Choice): HalfProfile | MultiPolygon | null {
  if (keyCache.has(choice)) return keyCache.get(choice)!;
  const v = choice.visual;
  const key =
    v.kind === 'solid' ? v.profile
    : v.kind === 'figure' ? halfProfile(v.figure)
    : v.kind === 'section' ? v.shape
    : null;
  keyCache.set(choice, key);
  return key;
}

function same(type: QuizType, a: Choice, b: Choice): boolean {
  const ka = compareKey(a);
  const kb = compareKey(b);
  if (ka === null || kb === null) return ka === null && kb === null;
  return type === 'C' ? sameSection(ka, kb) : sameProfile(ka, kb);
}

/** 후보 묶음(tier)을 앞에서부터 차례로, 묶음 안에서는 무작위 순서로 살펴 오답 3개를 고른다. */
function pickDistractors(type: QuizType, answer: Choice, tiers: Choice[][], rng: Rng): Choice[] {
  const chosen: Choice[] = [];
  for (const c of tiers.flatMap((tier) => shuffle(rng, tier))) {
    if (chosen.length === 3) break;
    if (compareKey(c) === null && chosen.some((x) => compareKey(x) === null)) continue;
    if (same(type, c, answer)) continue;
    if (chosen.some((x) => same(type, c, x))) continue;
    chosen.push(c);
  }
  return chosen;
}

function tryGenerate(type: QuizType, difficulty: Difficulty, rng: Rng): Question | null {
  const figure: Figure = randomFigure(difficulty, rng);
  const profile = halfProfile(figure);
  let cut: Cut | null = null;
  let answer: Choice;
  let candidates: Choice[][];
  let prompt: string;
  let question: Question['question'];
  let kind: 'solid' | 'figure' | 'section';

  if (type === 'A') {
    prompt = PROMPTS.A;
    question = { kind: 'figure', figure };
    answer = { visual: { kind: 'solid', profile }, why: '' };
    candidates = [solidCandidates(figure)];
    kind = 'solid';
  } else if (type === 'B') {
    prompt = PROMPTS.B;
    question = { kind: 'solid', profile };
    answer = { visual: { kind: 'figure', figure }, why: '' };
    candidates = [figureCandidates(figure)];
    kind = 'figure';
  } else {
    cut = rng() < 0.5 ? { kind: 'axial' } : { kind: 'perpendicular', h: pick(rng, safeCutHeights(profile)) };
    prompt = cut.kind === 'axial' ? PROMPTS.Caxial : PROMPTS.Cperp;
    question = { kind: 'solid-cut', profile, cut };
    answer = { visual: { kind: 'section', shape: sectionOf(profile, cut) }, why: '' };
    candidates = sectionCandidates(figure, cut, rng);
    kind = 'section';
  }

  const distractors = pickDistractors(type, answer, candidates, rng);
  for (let i = 0; i < 20 && distractors.length < 3; i++) {
    const filler = fillerChoice(kind, randomFigure(difficulty, rng), cut, rng);
    if (same(type, filler, answer) || distractors.some((d) => same(type, filler, d))) continue;
    distractors.push(filler);
  }
  if (distractors.length < 3) return null;

  const choices = shuffle(rng, [answer, ...distractors]);
  return { type, prompt, question, choices, answerIndex: choices.indexOf(answer), source: figure };
}

export function generateQuestion(type: QuizType, difficulty: Difficulty, rng: Rng): Question {
  for (let i = 0; i < 10; i++) {
    const q = tryGenerate(type, difficulty, rng);
    if (q) return q;
  }
  throw new Error(`문제를 만들지 못했어요: ${type}/${difficulty}`);
}
