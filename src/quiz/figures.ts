import { quarterCircle, rectangle, semicircle } from '../geometry/shapes.ts';
import type { Figure, Ring, Vec2 } from '../geometry/types.ts';
import { pick, randInt, type Rng } from './rng.ts';

export type Difficulty = 'basic' | 'advanced' | 'hard';

/** 세로축 x = 0 기준으로 만든 조각들. */
type Builder = (rng: Rng) => Ring[];

const basic: Builder[] = [
  (rng) => [rectangle(0, 0, randInt(rng, 2, 5), randInt(rng, 2, 6))],
  (rng) => {
    const w = randInt(rng, 2, 5);
    const h = randInt(rng, 2, 6);
    return [rng() < 0.5 ? [[0, 0], [w, 0], [0, h]] : [[0, 0], [w, h], [0, h]]];
  },
  (rng) => {
    const w1 = randInt(rng, 2, 5);
    let w2 = randInt(rng, 1, 4);
    if (w2 === w1) w2 = w1 - 1;
    const h = randInt(rng, 2, 5);
    return [[[0, 0], [w1, 0], [w2, h], [0, h]]];
  },
  (rng) => {
    const r = randInt(rng, 2, 4);
    return [semicircle(0, r, r, 'right')];
  },
];

const advanced: Builder[] = [
  // 원기둥 + 원뿔
  (rng) => {
    const w = randInt(rng, 2, 4);
    const h1 = randInt(rng, 2, 4);
    const h2 = randInt(rng, 2, 3);
    return [rectangle(0, 0, w, h1), [[0, h1], [w, h1], [0, h1 + h2]]];
  },
  // 계단 모양 (원기둥 + 원기둥)
  (rng) => {
    const w1 = randInt(rng, 3, 5);
    const w2 = randInt(rng, 1, w1 - 1);
    const h1 = randInt(rng, 1, 3);
    const h2 = randInt(rng, 1, 3);
    return [rectangle(0, 0, w1, h1), rectangle(0, h1, w2, h2)];
  },
  // 축에서 떨어진 직사각형
  (rng) => [rectangle(randInt(rng, 1, 2), 0, randInt(rng, 1, 3), randInt(rng, 2, 5))],
  // 축에서 떨어진 직각삼각형
  (rng) => {
    const g = randInt(rng, 1, 2);
    const w = randInt(rng, 2, 3);
    const h = randInt(rng, 2, 5);
    return [[[g, 0], [g + w, 0], [g, h]]];
  },
  // 축이 가로지르는 직사각형
  (rng) => {
    const a = randInt(rng, 1, 3);
    let b = randInt(rng, 1, 3);
    if (b === a) b = a + 1;
    return [rectangle(-a, 0, a + b, randInt(rng, 2, 5))];
  },
  // 원기둥 + 반구
  (rng) => {
    const r = randInt(rng, 2, 3);
    const h = randInt(rng, 2, 4);
    return [rectangle(0, 0, r, h), quarterCircle(0, h, r, 0)];
  },
  // 꼭짓점이 가운데 있는 삼각형 (원뿔 + 원뿔)
  (rng) => {
    const w = randInt(rng, 2, 4);
    const h1 = randInt(rng, 1, 3);
    const h2 = randInt(rng, 1, 3);
    return [[[0, 0], [w, h1], [0, h1 + h2]]];
  },
  // 축에서 떨어진 반원 (도넛 모양 일부)
  (rng) => {
    const r = randInt(rng, 1, 2);
    return [semicircle(1, r, r, 'right')];
  },
];

/** 심화: 기울어진 변이 있는 사다리꼴·평행사변형·삼각형. 어느 변이 축에 닿는지(혹은 안 닿는지) 따져야 한다. */
const hard: Builder[] = [
  // 양쪽 다리가 모두 기울어진 사다리꼴, 축에서 떨어짐
  (rng) => {
    const g = randInt(rng, 1, 2);
    const w1 = randInt(rng, 2, 4);
    const w2 = randInt(rng, 1, w1);
    const a = pick(rng, [-1, 1, 2].filter((v) => g + v >= 1));
    const h = randInt(rng, 2, 4);
    return [[[g, 0], [g + w1, 0], [g + a + w2, h], [g + a, h]]];
  },
  // 꼭짓점 하나만 축에 닿은 평행사변형 (속에 원뿔 모양 빈 곳)
  (rng) => {
    const w = randInt(rng, 2, 3);
    const s = randInt(rng, 1, 2);
    const h = randInt(rng, 2, 4);
    return [[[0, 0], [w, 0], [w + s, h], [s, h]]];
  },
  // 사다리꼴의 긴 밑변을 축으로 (원뿔 + 원기둥 + 원뿔)
  (rng) => {
    const d = randInt(rng, 2, 3);
    const a = randInt(rng, 1, 2);
    const t = randInt(rng, 1, 3);
    const b = randInt(rng, 1, 2);
    return [[[0, 0], [d, a], [d, a + t], [0, a + t + b]]];
  },
  // 사다리꼴의 짧은 밑변을 축으로 (양 끝이 원뿔 모양으로 파임)
  (rng) => {
    const d = randInt(rng, 2, 3);
    const a = randInt(rng, 1, 2);
    const t = randInt(rng, 1, 3);
    const b = randInt(rng, 1, 2);
    return [[[0, a], [d, 0], [d, a + t + b], [0, a + t]]];
  },
  // 축이 기울어진 사다리꼴을 가로지름
  (rng) => {
    const l = randInt(rng, 1, 3);
    let r = randInt(rng, 1, 3);
    if (r === l) r = l + 1;
    const h = randInt(rng, 2, 4);
    const shrinkL = randInt(rng, 0, 1);
    const shrinkR = 1 - shrinkL + randInt(rng, 0, 1);
    return [[[-l, 0], [r, 0], [r - shrinkR, h], [-l + shrinkL, h]]];
  },
  // 어느 변도 축에 붙지 않은 삼각형
  (rng) => {
    const g = randInt(rng, 1, 2);
    const w = randInt(rng, 2, 3);
    const c = randInt(rng, 0, w + 1);
    const h = randInt(rng, 2, 4);
    return [[[g, 0], [g + w, 0], [g + c, h]]];
  },
];

/** 심화: 도형의 비스듬한 변을 회전축으로 삼는 도형들. 조각과 축(oblique)을 함께 돌려준다. */
const obliqueHard: ((rng: Rng) => Figure)[] = [
  // 직각삼각형을 빗변을 축으로 (원뿔 두 개가 밑면끼리 붙은 모양)
  (rng) => {
    const a = randInt(rng, 2, 4);
    const b = randInt(rng, 2, 4);
    return { pieces: [[[0, 0], [a, 0], [0, b]]], axis: { dir: 'oblique', p: [a, 0], q: [0, b] } };
  },
  // 삼각형을 비스듬한 한 변을 축으로
  (rng) => {
    const w = randInt(rng, 2, 4);
    const h = randInt(rng, 2, 4);
    const c = pick(rng, [-1, 1, w + 1].filter((v) => v !== 0 && v !== w));
    return { pieces: [[[0, 0], [w, 0], [c, h]]], axis: { dir: 'oblique', p: [0, 0], q: [c, h] } };
  },
  // 직각사다리꼴을 기울어진 다리를 축으로
  (rng) => {
    const w1 = randInt(rng, 3, 4);
    const w2 = randInt(rng, 1, w1 - 1);
    const h = randInt(rng, 2, 3);
    return { pieces: [[[0, 0], [w1, 0], [w2, h], [0, h]]], axis: { dir: 'oblique', p: [w1, 0], q: [w2, h] } };
  },
  // 평행사변형을 비스듬한 변을 축으로
  (rng) => {
    const w = randInt(rng, 2, 3);
    const s = randInt(rng, 1, 2);
    const h = randInt(rng, 2, 3);
    return { pieces: [[[0, 0], [w, 0], [w + s, h], [s, h]]], axis: { dir: 'oblique', p: [0, 0], q: [s, h] } };
  },
];

const swapXY = ([x, y]: Vec2): Vec2 => [y, x];

/** 난이도에 맞는 무작위 도형. 절반은 x·y를 맞바꿔(대각선 대칭) 축 방향을 바꾼다. */
export function randomFigure(difficulty: Difficulty, rng: Rng): Figure {
  if (difficulty === 'hard' && rng() < 0.4) {
    const f = pick(rng, obliqueHard)(rng);
    if (rng() < 0.5 || f.axis.dir !== 'oblique') return f;
    return {
      pieces: f.pieces.map((ring) => ring.map(swapXY)),
      axis: { dir: 'oblique', p: swapXY(f.axis.p), q: swapXY(f.axis.q) },
    };
  }
  const pool = difficulty === 'basic' ? basic : difficulty === 'advanced' ? advanced : hard;
  const pieces = pick(rng, pool)(rng);
  if (rng() < 0.5) {
    return { pieces, axis: { dir: 'vertical', pos: 0 } };
  }
  return { pieces: pieces.map((ring) => ring.map(swapXY)), axis: { dir: 'horizontal', pos: 0 } };
}
