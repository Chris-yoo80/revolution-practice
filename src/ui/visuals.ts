import type { Question, Visual } from '../quiz/types.ts';
import { figureExtent, figureImage, sectionExtent, sectionImage } from '../render/draw2d.ts';
import { type Bounds3, mergeBounds, profileBounds } from '../render/solid.ts';
import { prismImage, solidImage } from '../render/thumbnail.ts';

/** 한 문제 안의 그림들이 같은 축척으로 그려지도록 공통 크기를 구한다. */
export interface QuestionScale {
  units2D: number;
  bounds3: Bounds3 | undefined;
}

export function questionScale(q: Question): QuestionScale {
  const visuals = [q.question, ...q.choices.map((c) => c.visual)];
  const extents: number[] = [];
  const bounds: Bounds3[] = [];
  for (const v of visuals) {
    if (v.kind === 'figure') extents.push(figureExtent(v.figure));
    if (v.kind === 'section') extents.push(sectionExtent(v.shape));
    if (v.kind === 'solid' || v.kind === 'solid-cut') bounds.push(profileBounds(v.profile));
  }
  return {
    units2D: (extents.length ? Math.max(...extents) : 4) + 2,
    bounds3: bounds.length ? mergeBounds(bounds) : undefined,
  };
}

export function visualImage(v: Visual, scale: QuestionScale, size = 240): string {
  switch (v.kind) {
    case 'figure':
      return figureImage(v.figure, scale.units2D, size);
    case 'section':
      return sectionImage(v.shape, scale.units2D, size);
    case 'solid':
      return solidImage(v.profile, { fitBounds: scale.bounds3, size });
    case 'solid-cut':
      return solidImage(v.profile, { fitBounds: scale.bounds3, cut: v.cut, size });
    case 'prism':
      return prismImage(v.figure, size);
  }
}

