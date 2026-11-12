import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { exploreScreen } from './ui/explore.ts';
import { homeScreen } from './ui/home.ts';
import { quizScreen } from './ui/quiz.ts';
import { startRouter } from './ui/router.ts';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const root = document.getElementById('app')!;
if (!hasWebGL()) {
  root.innerHTML = '<p style="padding:40px;font-size:20px;text-align:center">이 기기에서는 3D를 표시할 수 없어요.</p>';
} else {
  startRouter(root, { home: homeScreen, explore: exploreScreen, quiz: quizScreen });
}

registerSW({ immediate: true });
