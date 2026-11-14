import { classify } from '../geometry/classify.ts';
import { halfProfile } from '../geometry/profile.ts';
import { annuliToShape, axialSection, perpendicularSection } from '../geometry/sections.ts';
import { PRESETS } from '../geometry/shapes.ts';
import type { HalfProfile } from '../geometry/types.ts';
import { AXIS_HINT, GridEditor } from '../editor/gridEditor.ts';
import { paintSection } from '../render/draw2d.ts';
import { profileBounds } from '../render/solid.ts';
import { SolidViewer } from '../render/viewer.ts';
import { feedbackAnchor, h, segmented } from './dom.ts';
import type { Screen } from './router.ts';

type SectionKind = 'none' | 'axial' | 'perpendicular';

const SWEEP_MS = 3000;

export const exploreScreen: Screen = (root, go) => {
  const message = h('p.message', {}, '');
  const gridCanvas = h('canvas.grid-canvas');
  const viewerBox = h('div.viewer');
  const nameTag = h('div.name-tag', {}, '도형을 고르거나 그려 보세요');
  const angleInput = h('input.slider', { type: 'range', min: '0', max: '360', step: '1', value: '360' });
  const angleLabel = h('span.slider-label', {}, '360°');
  const playBtn = h('button.play', { type: 'button' }, '▶ 돌리기');
  const cutInput = h('input.slider', { type: 'range', min: '0', max: '100', step: '1', value: '50' });
  const cutLabel = h('span.slider-label', {}, '');
  const cutRow = h('div.row.cut-row', { hidden: true }, h('span.row-label', {}, '자르는 위치'), cutInput, cutLabel);
  const miniCanvas = h('canvas.mini-section', { width: 220, height: 220, hidden: true });

  let profile: HalfProfile = [];
  let sectionKind: SectionKind = 'none';
  let animFrame = 0;

  const viewer = new SolidViewer(viewerBox);
  const editor = new GridEditor(gridCanvas, {
    onChange: (f) => {
      profile = f ? halfProfile(f) : [];
      viewer.setFigure(f);
      nameTag.textContent = profile.length ? `→ ${classify(profile).name}` : '도형을 고르거나 그려 보세요';
      updateSection();
    },
    onMessage: (m) => {
      message.textContent = m;
    },
  });

  function setAngle(deg: number) {
    angleInput.value = String(Math.round(deg));
    angleLabel.textContent = `${Math.round(deg)}°`;
    viewer.setAngle(deg);
  }

  function stopAnim() {
    cancelAnimationFrame(animFrame);
    animFrame = 0;
    playBtn.textContent = '▶ 돌리기';
  }

  function play() {
    if (animFrame) {
      stopAnim();
      return;
    }
    const startDeg = Number(angleInput.value) >= 360 ? 0 : Number(angleInput.value);
    const start = performance.now() - (startDeg / 360) * SWEEP_MS;
    playBtn.textContent = '⏸ 멈추기';
    const step = (now: number) => {
      const deg = Math.min(360, ((now - start) / SWEEP_MS) * 360);
      setAngle(deg);
      if (deg < 360) animFrame = requestAnimationFrame(step);
      else stopAnim();
    };
    animFrame = requestAnimationFrame(step);
  }

  function updateSection() {
    const active = sectionKind !== 'none' && profile.length > 0;
    cutRow.hidden = sectionKind === 'none';
    miniCanvas.hidden = !active;
    playBtn.disabled = sectionKind !== 'none';
    angleInput.disabled = sectionKind !== 'none';
    if (!active) {
      viewer.setCut(null);
      return;
    }
    stopAnim();
    setAngle(360);
    const t = Number(cutInput.value) / 100;
    const b = profileBounds(profile);
    const units = b.radius * 2 + 2;
    if (sectionKind === 'axial') {
      const angleDeg = t * 180;
      cutLabel.textContent = `${Math.round(angleDeg)}°`;
      viewer.setCut({ cut: { kind: 'axial' }, angleDeg });
      paintSection(miniCanvas, axialSection(profile), Math.max(units, b.maxH - b.minH + 2));
    } else {
      const tt = Math.min(0.98, Math.max(0.02, t));
      const hh = b.minH + tt * (b.maxH - b.minH);
      cutLabel.textContent = `높이 ${hh.toFixed(1)}`;
      viewer.setCut({ cut: { kind: 'perpendicular', h: hh }, angleDeg: 0 });
      const shape = annuliToShape(perpendicularSection(profile, hh));
      if (shape.length) paintSection(miniCanvas, shape, units);
      else miniCanvas.getContext('2d')!.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    }
  }

  angleInput.addEventListener('input', () => {
    stopAnim();
    setAngle(Number(angleInput.value));
  });
  cutInput.addEventListener('input', updateSection);
  playBtn.addEventListener('click', play);

  const presetButtons = PRESETS.map((p) =>
    h('button.chip', {
      type: 'button',
      onclick: () => {
        message.textContent = '';
        editor.setFigure(p.figure, p.editable);
      },
    }, p.label),
  );

  root.append(
    h('main.explore',
      {},
      h('header.topbar', {}, h('button.back', { type: 'button', onclick: () => go('home') }, '← 홈'), h('h2', {}, '탐구하기'), feedbackAnchor('탐구하기')),
      h('div.explore-body',
        {},
        h('section.panel.panel-2d',
          {},
          h('div.chips', {}, ...presetButtons),
          h('div.row',
            {},
            h('button.tool', { type: 'button', onclick: () => editor.startDrawing() }, '✏️ 직접 그리기'),
            h('button.tool', { type: 'button', onclick: () => { message.textContent = ''; editor.clear(); } }, '지우기'),
            h('span.row-label', {}, '회전축'),
            h('button.tool', { type: 'button', onclick: () => editor.setAxisPreset('vertical') }, '세로축'),
            h('button.tool', { type: 'button', onclick: () => editor.setAxisPreset('horizontal') }, '가로축'),
          ),
          h('div.grid-wrap', {}, gridCanvas),
          h('p.hint', {}, h('span.handle-dot', { 'aria-hidden': 'true' }), ' ', AXIS_HINT),
          message,
        ),
        h('section.panel.panel-3d',
          {},
          h('div.viewer-wrap', {}, viewerBox, nameTag, miniCanvas),
          h('div.row', {}, playBtn, angleInput, angleLabel),
          h('div.row',
            {},
            h('span.row-label', {}, '단면'),
            segmented<SectionKind>(
              [
                { value: 'none', label: '없음' },
                { value: 'axial', label: '축을 포함' },
                { value: 'perpendicular', label: '축에 수직' },
              ],
              'none',
              (k) => {
                sectionKind = k;
                cutInput.value = '50';
                updateSection();
              },
            ),
          ),
          cutRow,
        ),
      ),
    ),
  );

  editor.setFigure(PRESETS[0].figure, PRESETS[0].editable);

  return () => {
    stopAnim();
    editor.dispose();
    viewer.dispose();
  };
};
