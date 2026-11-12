import { describe, expect, it } from 'vitest';
import { bbox } from '../../src/geometry/polygon.ts';
import { halfProfile } from '../../src/geometry/profile.ts';
import { axialSection, intervalsAt, perpendicularSection, safeCutHeights } from '../../src/geometry/sections.ts';
import { rectangle } from '../../src/geometry/shapes.ts';
import type { Axis } from '../../src/geometry/types.ts';

const vAxis: Axis = { dir: 'vertical', pos: 0 };

describe('sections', () => {
  it('원기둥을 수직으로 자르면 원 하나', () => {
    const hp = halfProfile({ pieces: [rectangle(0, 0, 3, 5)], axis: vAxis });
    expect(perpendicularSection(hp, 2.5)).toEqual([{ inner: 0, outer: 3 }]);
  });

  it('가운데가 빈 원기둥을 수직으로 자르면 고리 하나', () => {
    const hp = halfProfile({ pieces: [rectangle(1, 0, 2, 4)], axis: vAxis });
    expect(perpendicularSection(hp, 2)).toEqual([{ inner: 1, outer: 3 }]);
  });

  it('원뿔을 축을 포함하는 평면으로 자르면 선대칭 이등변삼각형', () => {
    const hp = halfProfile({ pieces: [[[0, 0], [3, 0], [0, 5]]], axis: vAxis });
    const sec = axialSection(hp);
    expect(sec).toHaveLength(1);
    expect(sec[0][0]).toHaveLength(3);
    expect(bbox(sec)).toEqual({ minX: -3, minY: 0, maxX: 3, maxY: 5 });
  });

  it('꼭짓점 높이에서도 구간을 두 번 세지 않는다', () => {
    const hp = halfProfile({ pieces: [rectangle(0, 0, 4, 2), rectangle(0, 2, 2, 3)], axis: vAxis });
    expect(intervalsAt(hp, 2)).toEqual([{ inner: 0, outer: 2 }]);
  });

  it('안전한 자르기 높이는 꼭짓점 높이 사이의 중간값', () => {
    const hp = halfProfile({ pieces: [rectangle(0, 0, 4, 2), rectangle(0, 2, 2, 3)], axis: vAxis });
    expect(safeCutHeights(hp)).toEqual([1, 3.5]);
  });
});
