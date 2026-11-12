import { describe, expect, it } from 'vitest';
import { sameProfile, sameSection } from '../../src/geometry/equality.ts';
import { halfProfile } from '../../src/geometry/profile.ts';
import { annuliToShape } from '../../src/geometry/sections.ts';
import { rectangle } from '../../src/geometry/shapes.ts';
import type { Axis, Ring } from '../../src/geometry/types.ts';

const vAxis: Axis = { dir: 'vertical', pos: 0 };
const hp = (pieces: Ring[], axis: Axis = vAxis) => halfProfile({ pieces, axis });

describe('sameProfile', () => {
  it('축 방향으로 옮긴 같은 도형은 같은 회전체', () => {
    expect(sameProfile(hp([rectangle(0, 0, 3, 4)]), hp([rectangle(0, 5, 3, 4)]))).toBe(true);
  });

  it('위아래로 뒤집은 원뿔은 같은 회전체', () => {
    expect(sameProfile(hp([[[0, 0], [3, 0], [0, 5]]]), hp([[[0, 0], [3, 5], [0, 5]]]))).toBe(true);
  });

  it('직사각형의 왼쪽 변과 오른쪽 변을 축으로 돌리면 같은 원기둥', () => {
    expect(sameProfile(hp([rectangle(0, 0, 3, 4)]), hp([rectangle(0, 0, 3, 4)], { dir: 'vertical', pos: 3 }))).toBe(true);
  });

  it('가로 변을 축으로 돌리면 다른 원기둥', () => {
    expect(sameProfile(hp([rectangle(0, 0, 3, 4)]), hp([rectangle(0, 0, 3, 4)], { dir: 'horizontal', pos: 0 }))).toBe(false);
  });

  it('축에서 떨어뜨리면 다른 회전체', () => {
    expect(sameProfile(hp([rectangle(0, 0, 3, 4)]), hp([rectangle(1, 0, 3, 4)]))).toBe(false);
  });
});

describe('sameSection', () => {
  it('원과 고리는 다르다', () => {
    expect(sameSection(annuliToShape([{ inner: 0, outer: 3 }]), annuliToShape([{ inner: 1, outer: 3 }]))).toBe(false);
  });

  it('반지름이 다른 원은 다르다', () => {
    expect(sameSection(annuliToShape([{ inner: 0, outer: 3 }]), annuliToShape([{ inner: 0, outer: 2 }]))).toBe(false);
  });

  it('같은 원은 같다', () => {
    expect(sameSection(annuliToShape([{ inner: 0, outer: 3 }]), annuliToShape([{ inner: 0, outer: 3 }]))).toBe(true);
  });
});
