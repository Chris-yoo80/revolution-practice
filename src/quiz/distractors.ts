import { bbox, mapPoints, rect, ringsToMulti, union } from '../geometry/polygon.ts';
import { axisPoints, axisThrough, figureInAxisFrame, fromAxisPoint, halfProfile } from '../geometry/profile.ts';
import { annuliToShape, axialSection, perpendicularSection, safeCutHeights } from '../geometry/sections.ts';
import type { Axis, Figure, HalfProfile, MultiPolygon, Ring, Vec2 } from '../geometry/types.ts';
import type { Rng } from './rng.ts';
import { pick } from './rng.ts';
import type { Choice, Cut } from './types.ts';

export const WHY = {
  otherAxis: '다른 변을 축으로 돌린 모양이에요.',
  filled: '도형과 축 사이가 떨어져 있으면 가운데가 비어요.',
  hollowed: '도형이 축에 붙어 있으면 가운데가 채워져요.',
  prism: '돌린 게 아니라 앞으로 밀어낸 모양이에요.',
  mirrored: '원래 도형과 모양이 달라요. 어느 쪽이 축에 붙어 있는지 확인해 보세요.',
  dropped: '도형의 일부가 빠진 모양이에요.',
  figOtherAxis: '이 도형을 이 축으로 돌리면 다른 회전체가 돼요.',
  figAway: '도형과 축 사이가 떨어져 있으면 가운데가 빈 회전체가 돼요.',
  figToward: '도형이 축에 붙어 있으면 가운데가 채워진 회전체가 돼요.',
  secPerp: '회전축에 수직인 평면으로 자른 단면이에요.',
  secAxial: '회전축을 포함하는 평면으로 자른 단면이에요.',
  secHalf: '반쪽만 그렸어요. 이 단면은 회전축을 기준으로 선대칭이에요.',
  secFilled: '가운데 빈 부분까지 채워 버렸어요.',
  secNeedHole: '이 높이에서는 가운데가 비어 있어야 해요.',
  secNeedFill: '이 높이에서는 가운데가 채워져 있어야 해요.',
  secOtherHeight: '다른 높이에서 자른 단면이에요.',
  secOtherAxis: '다른 변을 축으로 돌린 회전체의 단면이에요.',
  random: '전혀 다른 도형에서 만든 모양이에요.',
};

/** 두 축이 같은 직선인지. */
function sameLine(a: Axis, b: Axis): boolean {
  const [p, q] = axisPoints(a);
  const onA = ([x, y]: Vec2) => Math.abs((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])) < 1e-9;
  return axisPoints(b).every(onA);
}

/**
 * '다른 변을 축으로' 오답에 쓸 축들: 도형을 감싸는 상자의 네 변,
 * 그리고 지금 축이 비스듬하면 도형의 모든 변. 현재 축과 같은 직선은 뺀다.
 */
export function alternativeAxes(figure: Figure): Axis[] {
  const b = bbox(ringsToMulti(figure.pieces));
  const all: Axis[] = [
    { dir: 'vertical', pos: b.minX },
    { dir: 'vertical', pos: b.maxX },
    { dir: 'horizontal', pos: b.minY },
    { dir: 'horizontal', pos: b.maxY },
  ];
  if (figure.axis.dir === 'oblique') {
    for (const ring of figure.pieces) {
      ring.forEach((pt, i) => all.push(axisThrough(pt, ring[(i + 1) % ring.length])));
    }
  }
  const out: Axis[] = [];
  for (const a of all) {
    if (sameLine(a, figure.axis) || out.some((o) => sameLine(o, a))) continue;
    out.push(a);
  }
  return out;
}

/** 축 좌표에서 도형을 바꾼 뒤 모눈 좌표로 되돌린다. */
function transformInAxisFrame(figure: Figure, f: (p: Vec2, rMin: number, rMax: number) => Vec2): Figure {
  const rings = figureInAxisFrame(figure);
  const b = bbox(ringsToMulti(rings));
  const pieces: Ring[] = rings.map((ring) => ring.map((p) => fromAxisPoint(f(p, b.minX, b.maxX), figure.axis)));
  return { pieces, axis: figure.axis };
}

/** 도형을 축 방향(r)으로 좌우 뒤집는다. 직각삼각형이면 빗변 방향이 바뀐다. */
export function mirroredFigure(figure: Figure): Figure {
  return transformInAxisFrame(figure, ([r, h], rMin, rMax) => [rMin + rMax - r, h]);
}

/** 도형을 축에서 d만큼 멀어지게(음수면 가까워지게) 옮긴다. */
export function shiftedFigure(figure: Figure, d: number): Figure {
  return transformInAxisFrame(figure, ([r, h]) => [r + d, h]);
}

export function minRadius(profile: HalfProfile): number {
  return bbox(profile).minX;
}

/** 가운데 빈 곳을 축까지 채운 반쪽 단면. */
export function filledProfile(profile: HalfProfile): HalfProfile {
  const b = bbox(profile);
  return union(profile, rect(0, b.minY, b.minX, b.maxY));
}

/**
 * 도형이 축의 어느 쪽(sign)에 있는지와 축까지 가장 가까운 거리(gap).
 * 축이 도형을 가로지르면 null. 비스듬한 축에서는 도형이 r < 0 쪽에 놓일 수도 있다.
 */
function figureSide(figure: Figure): { sign: 1 | -1; gap: number } | null {
  const b = bbox(ringsToMulti(figureInAxisFrame(figure)));
  const EPS = 1e-9;
  if (b.minX >= -EPS) return { sign: 1, gap: b.minX > EPS ? b.minX : 0 };
  if (b.maxX <= EPS) return { sign: -1, gap: b.maxX < -EPS ? -b.maxX : 0 };
  return null;
}

function withoutPiece(figure: Figure, i: number): Figure {
  return { pieces: figure.pieces.filter((_, j) => j !== i), axis: figure.axis };
}

/** 유형 A: 평면도형 → 회전체 보기 후보 */
export function solidCandidates(figure: Figure): Choice[] {
  const profile = halfProfile(figure);
  const out: Choice[] = [];
  for (const axis of alternativeAxes(figure)) {
    out.push({ visual: { kind: 'solid', profile: halfProfile({ pieces: figure.pieces, axis }) }, why: WHY.otherAxis });
  }
  if (minRadius(profile) > 0) {
    out.push({ visual: { kind: 'solid', profile: filledProfile(profile) }, why: WHY.filled });
  } else {
    out.push({ visual: { kind: 'solid', profile: mapPoints(profile, ([r, h]) => [r + 1, h]) }, why: WHY.hollowed });
  }
  out.push({ visual: { kind: 'prism', figure }, why: WHY.prism });
  out.push({ visual: { kind: 'solid', profile: halfProfile(mirroredFigure(figure)) }, why: WHY.mirrored });
  if (figure.pieces.length > 1) {
    figure.pieces.forEach((_, i) => {
      out.push({ visual: { kind: 'solid', profile: halfProfile(withoutPiece(figure, i)) }, why: WHY.dropped });
    });
  }
  return out;
}

/** 유형 B: 회전체 → 평면도형 보기 후보 */
export function figureCandidates(figure: Figure): Choice[] {
  const out: Choice[] = [];
  for (const axis of alternativeAxes(figure)) {
    out.push({ visual: { kind: 'figure', figure: { pieces: figure.pieces, axis } }, why: WHY.figOtherAxis });
  }
  out.push({ visual: { kind: 'figure', figure: mirroredFigure(figure) }, why: WHY.mirrored });
  const side = figureSide(figure);
  if (side && side.gap > 0) {
    out.push({ visual: { kind: 'figure', figure: shiftedFigure(figure, -side.sign * side.gap) }, why: WHY.figToward });
  } else if (side) {
    out.push({ visual: { kind: 'figure', figure: shiftedFigure(figure, side.sign) }, why: WHY.figAway });
  }
  if (figure.pieces.length > 1) {
    figure.pieces.forEach((_, i) => {
      out.push({ visual: { kind: 'figure', figure: withoutPiece(figure, i) }, why: WHY.dropped });
    });
  }
  return out;
}

export function sectionOf(profile: HalfProfile, cut: Cut): MultiPolygon {
  return cut.kind === 'axial' ? axialSection(profile) : annuliToShape(perpendicularSection(profile, cut.h));
}

/**
 * 유형 C: 단면 보기 후보. [핵심 후보, 나머지 후보] 두 묶음으로 돌려준다.
 * 핵심 후보(가운데 빈/채움 혼동, 다른 높이, 반쪽만 그리기)를 먼저 뽑아야
 * '수직 단면 = 원 하나'처럼 모양만 보고 고르는 문제가 되지 않는다.
 */
export function sectionCandidates(figure: Figure, cut: Cut, rng: Rng): Choice[][] {
  const profile = halfProfile(figure);
  const heights = safeCutHeights(profile);
  const core: Choice[] = [];
  const extra: Choice[] = [];
  const section = (shape: MultiPolygon, why: string): Choice => ({ visual: { kind: 'section', shape }, why });

  if (cut.kind === 'axial') {
    core.push(section(profile, WHY.secHalf));
    if (minRadius(profile) > 0) core.push(section(axialSection(filledProfile(profile)), WHY.secFilled));
    extra.push(section(sectionOf(profile, { kind: 'perpendicular', h: pick(rng, heights) }), WHY.secPerp));
  } else {
    const annuli = perpendicularSection(profile, cut.h);
    if (annuli.some((a) => a.inner > 0)) {
      core.push(section(annuliToShape(annuli.map((a) => ({ inner: 0, outer: a.outer }))), WHY.secNeedHole));
    } else {
      core.push(section(annuliToShape(annuli.map((a) => ({ inner: a.outer / 2, outer: a.outer }))), WHY.secNeedFill));
    }
    const others = heights.filter((h) => h !== cut.h);
    if (others.length) core.push(section(sectionOf(profile, { kind: 'perpendicular', h: pick(rng, others) }), WHY.secOtherHeight));
    extra.push(section(axialSection(profile), WHY.secAxial));
    for (const h of others) extra.push(section(sectionOf(profile, { kind: 'perpendicular', h }), WHY.secOtherHeight));
  }
  for (const axis of alternativeAxes(figure)) {
    const other = halfProfile({ pieces: figure.pieces, axis });
    extra.push(section(axialSection(other), WHY.secOtherAxis));
  }
  return [core, extra];
}

/** 다른 무작위 도형으로 만든 같은 종류의 보기. */
export function fillerChoice(kind: 'solid' | 'figure' | 'section', other: Figure, cut: Cut | null, rng: Rng): Choice {
  if (kind === 'figure') return { visual: { kind: 'figure', figure: other }, why: WHY.random };
  const profile = halfProfile(other);
  if (kind === 'solid') return { visual: { kind: 'solid', profile }, why: WHY.random };
  const otherCut: Cut =
    cut?.kind === 'perpendicular' ? { kind: 'perpendicular', h: pick(rng, safeCutHeights(profile)) } : { kind: 'axial' };
  return { visual: { kind: 'section', shape: sectionOf(profile, otherCut) }, why: WHY.random };
}
