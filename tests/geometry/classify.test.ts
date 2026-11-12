import { describe, expect, it } from 'vitest';
import { classify } from '../../src/geometry/classify.ts';
import { halfProfile } from '../../src/geometry/profile.ts';
import { PRESETS, rectangle } from '../../src/geometry/shapes.ts';
import type { Axis, Ring } from '../../src/geometry/types.ts';

const vAxis: Axis = { dir: 'vertical', pos: 0 };
const nameOf = (pieces: Ring[], axis: Axis = vAxis) => classify(halfProfile({ pieces, axis })).name;

describe('classify', () => {
  it.each([
    ['rect', '원기둥'],
    ['tri', '원뿔'],
    ['trap', '원뿔대'],
    ['semi', '구'],
    ['circle', '가운데가 빈 회전체'],
    ['cyl-cone', '원기둥 + 원뿔'],
    ['off-rect', '가운데가 빈 원기둥'],
    ['stairs', '원기둥 + 원기둥'],
  ])('프리셋 %s → %s', (id, expected) => {
    const preset = PRESETS.find((p) => p.id === id)!;
    expect(classify(halfProfile(preset.figure)).name).toBe(expected);
  });

  it('꼭짓점이 가운데 있는 삼각형은 원뿔 두 개', () => {
    expect(nameOf([[[0, 0], [3, 2], [0, 4]]])).toBe('원뿔 + 원뿔');
  });

  it('가로축으로 돌린 직사각형도 원기둥', () => {
    expect(nameOf([rectangle(0, 0, 5, 2)], { dir: 'horizontal', pos: 0 })).toBe('원기둥');
  });

  it('빈 단면은 이름이 없다', () => {
    expect(classify([]).name).toBe('');
  });
});
