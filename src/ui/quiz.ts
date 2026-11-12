import type { Difficulty } from '../quiz/figures.ts';
import { bestKey, loadBest, type QuizMode, QuizSession, saveBest } from '../quiz/session.ts';
import type { QuizType } from '../quiz/types.ts';
import { SolidViewer } from '../render/viewer.ts';
import { h, segmented } from './dom.ts';
import type { Screen } from './router.ts';
import { questionScale, visualImage } from './visuals.ts';

const QUESTION_COUNT = 10;
const TYPE_LABEL: Record<QuizType, string> = {
  A: '회전체 맞히기',
  B: '원래 도형 찾기',
  C: '단면 맞히기',
};
const MARKS = ['①', '②', '③', '④'];

function storage() {
  try {
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  }
}

export const quizScreen: Screen = (root, go) => {
  let mode: QuizMode = 'all';
  let difficulty: Difficulty = 'basic';
  let session: QuizSession | null = null;
  let explainViewer: SolidViewer | null = null;
  let timers: number[] = [];

  const body = h('div.quiz-body');
  root.append(
    h('main.quiz',
      {},
      h('header.topbar', {}, h('button.back', { type: 'button', onclick: () => go('home') }, '← 홈'), h('h2', {}, '문제 풀기')),
      body,
    ),
  );

  function clearExplain() {
    explainViewer?.dispose();
    explainViewer = null;
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function showSetup() {
    clearExplain();
    const best = loadBest(storage(), bestKey({ mode, difficulty }));
    const bestLine = h('p.best', {}, best === null ? '아직 기록이 없어요' : `최고 기록 ${best} / ${QUESTION_COUNT}`);
    const refreshBest = () => {
      const b = loadBest(storage(), bestKey({ mode, difficulty }));
      bestLine.textContent = b === null ? '아직 기록이 없어요' : `최고 기록 ${b} / ${QUESTION_COUNT}`;
    };
    body.replaceChildren(
      h('section.setup',
        {},
        h('h3', {}, '문제 유형'),
        segmented<QuizMode>(
          [
            { value: 'all', label: '골고루' },
            { value: 'A', label: TYPE_LABEL.A },
            { value: 'B', label: TYPE_LABEL.B },
            { value: 'C', label: TYPE_LABEL.C },
          ],
          mode,
          (m) => { mode = m; refreshBest(); },
        ),
        h('h3', {}, '난이도'),
        segmented<Difficulty>(
          [{ value: 'basic', label: '기본' }, { value: 'advanced', label: '응용' }, { value: 'hard', label: '심화' }],
          difficulty,
          (d) => { difficulty = d; refreshBest(); },
        ),
        bestLine,
        h('button.big.primary.start', { type: 'button', onclick: start }, `${QUESTION_COUNT}문제 시작`),
      ),
    );
  }

  function start() {
    body.replaceChildren(h('p.loading', {}, '문제를 만드는 중…'));
    // 문제 생성은 조금 걸리므로 '만드는 중' 문구가 먼저 그려지게 한다
    timers.push(window.setTimeout(() => {
      session = new QuizSession({ mode, difficulty, count: QUESTION_COUNT });
      showQuestion();
    }, 30));
  }

  function showQuestion() {
    clearExplain();
    const s = session!;
    if (s.finished) {
      showResult();
      return;
    }
    const q = s.current;
    const scale = questionScale(q);
    const feedback = h('div.feedback');
    const choiceButtons = q.choices.map((c, i) =>
      h('button.choice', { type: 'button', onclick: () => choose(i) },
        h('span.mark', {}, MARKS[i]),
        h('img', { src: visualImage(c.visual, scale), alt: `보기 ${i + 1}` }),
      ),
    );

    function choose(i: number) {
      choiceButtons.forEach((b) => (b.disabled = true));
      const correct = s.answer(i);
      choiceButtons[q.answerIndex].classList.add('correct');
      if (correct) {
        feedback.replaceChildren(h('p.ok', {}, '⭕ 정답이에요!'));
        timers.push(window.setTimeout(() => { s.next(); showQuestion(); }, 1000));
        return;
      }
      choiceButtons[i].classList.add('wrong');
      const viewerBox = h('div.explain-viewer');
      feedback.replaceChildren(
        h('div.explain',
          {},
          h('p.no', {}, `❌ 아쉬워요. 정답은 ${MARKS[q.answerIndex]}이에요.`),
          h('p.why', {}, q.choices[i].why),
          viewerBox,
          h('button.primary.next', { type: 'button', onclick: () => { s.next(); showQuestion(); } }, '다음 문제 →'),
        ),
      );
      feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });
      explainViewer = new SolidViewer(viewerBox);
      explainViewer.setFigure(q.source);
      playExplain(q.question.kind === 'solid-cut' ? q.question.cut : null);
    }

    body.replaceChildren(
      h('section.question',
        {},
        h('div.progress', {}, `${s.index + 1} / ${s.questions.length}`, h('span.type-tag', {}, TYPE_LABEL[q.type])),
        h('p.prompt', {}, q.prompt),
        h('img.question-img', { src: visualImage(q.question, scale, 320), alt: '문제 그림' }),
        h('div.choices', {}, ...choiceButtons),
        feedback,
      ),
    );
  }

  /** 해설: 원래 도형이 돌아가며 회전체가 되는 모습, 유형 C면 이어서 단면을 보여준다. */
  function playExplain(cut: import('../geometry/types.ts').Cut | null) {
    const v = explainViewer!;
    const startAt = performance.now();
    const step = (now: number) => {
      if (explainViewer !== v) return;
      const deg = Math.min(360, ((now - startAt) / 2500) * 360);
      v.setAngle(deg);
      if (deg < 360) requestAnimationFrame(step);
      else if (cut) timers.push(window.setTimeout(() => v.setCut({ cut, angleDeg: 35 }), 400));
    };
    v.setAngle(0);
    requestAnimationFrame(step);
  }

  function showResult() {
    const r = session!.result();
    const key = bestKey({ mode, difficulty });
    const isBest = saveBest(storage(), key, r.score);
    const rows = (Object.keys(r.byType) as QuizType[])
      .filter((t) => r.byType[t].total > 0)
      .map((t) => h('li', {}, `${TYPE_LABEL[t]}: ${r.byType[t].correct} / ${r.byType[t].total}`));
    body.replaceChildren(
      h('section.result',
        {},
        h('p.score', {}, `${r.score} / ${r.total}`),
        isBest ? h('p.new-best', {}, '🎉 최고 기록이에요!') : null,
        h('ul.by-type', {}, ...rows),
        h('div.row.center',
          {},
          h('button.primary', { type: 'button', onclick: start }, '다시 하기'),
          h('button.tool', { type: 'button', onclick: showSetup }, '유형 바꾸기'),
          h('button.tool', { type: 'button', onclick: () => go('home') }, '홈으로'),
        ),
      ),
    );
  }

  showSetup();
  return () => clearExplain();
};
