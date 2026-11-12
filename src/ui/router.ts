export type ScreenName = 'home' | 'explore' | 'quiz';

/** 화면을 root에 그리고, 화면을 떠날 때 부를 정리 함수를 돌려준다. */
export type Screen = (root: HTMLElement, go: (name: ScreenName) => void) => () => void;

function current(): ScreenName {
  const name = location.hash.replace('#/', '');
  return name === 'explore' || name === 'quiz' ? name : 'home';
}

/** 주소의 #/explore, #/quiz 에 따라 화면을 바꾼다. 안드로이드 뒤로 가기도 그대로 동작한다. */
export function startRouter(root: HTMLElement, screens: Record<ScreenName, Screen>): void {
  let cleanup: (() => void) | null = null;
  const go = (name: ScreenName) => {
    location.hash = name === 'home' ? '' : `#/${name}`;
  };
  const render = () => {
    cleanup?.();
    root.replaceChildren();
    cleanup = screens[current()](root, go);
  };
  window.addEventListener('hashchange', render);
  render();
}
