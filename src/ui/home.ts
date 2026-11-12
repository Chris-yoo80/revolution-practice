import { h } from './dom.ts';
import type { Screen } from './router.ts';

export const homeScreen: Screen = (root, go) => {
  root.append(
    h('main.home',
      {},
      h('div.home-badge', {}, '중1 도형 · 회전체'),
      h('h1.home-title', {}, '회전체 연습'),
      h('p.home-sub', {}, '평면도형을 회전축 둘레로 한 바퀴 돌리면 어떤 입체가 될까요?'),
      h('div.home-actions',
        {},
        h('button.big.primary', { type: 'button', onclick: () => go('explore') },
          h('span.big-icon', {}, '🔄'), h('span', {}, '탐구하기'), h('small', {}, '도형을 골라 직접 돌려 보기')),
        h('button.big.secondary', { type: 'button', onclick: () => go('quiz') },
          h('span.big-icon', {}, '✏️'), h('span', {}, '문제 풀기'), h('small', {}, '회전체·원래 도형·단면 맞히기')),
      ),
    ),
  );
  return () => {};
};
