import type { Cut, Figure, HalfProfile, MultiPolygon } from '../geometry/types.ts';

export type { Cut };

export type QuizType = 'A' | 'B' | 'C';

/** 화면에 그릴 그림 한 장의 설명. 그리는 일은 render/ 가 맡는다. */
export type Visual =
  | { kind: 'figure'; figure: Figure }
  | { kind: 'solid'; profile: HalfProfile }
  | { kind: 'prism'; figure: Figure }
  | { kind: 'section'; shape: MultiPolygon }
  | { kind: 'solid-cut'; profile: HalfProfile; cut: Cut };

export interface Choice {
  visual: Visual;
  /** 이 보기를 골랐을 때 보여줄 해설. 정답이면 빈 문자열. */
  why: string;
}

export interface Question {
  type: QuizType;
  prompt: string;
  question: Visual;
  choices: Choice[];
  answerIndex: number;
  /** 해설 애니메이션에 쓰는 원래 도형 */
  source: Figure;
}
