import { intervalsAt } from './sections.ts';
import type { HalfProfile } from './types.ts';

export type SolidPart = '원기둥' | '원뿔' | '원뿔대' | '구';

export interface Classification {
  /** 화면에 보여줄 이름. 예: "원기둥", "원기둥 + 원뿔", "가운데가 빈 원기둥", "회전체" */
  name: string;
  parts: SolidPart[];
  hollow: boolean;
}

const TOL = 1e-3;

function isSphere(profile: HalfProfile): boolean {
  if (profile.length !== 1 || profile[0].length !== 1) return false;
  const ring = profile[0][0];
  if (ring.length < 16) return false;
  const hs = ring.map((p) => p[1]);
  const hMin = Math.min(...hs);
  const hMax = Math.max(...hs);
  const radius = (hMax - hMin) / 2;
  const hc = (hMin + hMax) / 2;
  return ring.every(([r, h]) => Math.abs(Math.hypot(r, h - hc) - radius) < radius * 0.02);
}

export function classify(profile: HalfProfile): Classification {
  if (profile.length === 0) return { name: '', parts: [], hollow: false };
  if (isSphere(profile)) return { name: '구', parts: ['구'], hollow: false };

  const hs = new Set<number>();
  for (const poly of profile) for (const ring of poly) for (const [, h] of ring) hs.add(h);
  const heights = [...hs].sort((a, b) => a - b);

  const parts: SolidPart[] = [];
  let hollow = false;
  let complex = false;
  let constantInner = true;

  for (let i = 0; i + 1 < heights.length; i++) {
    const a = heights[i];
    const b = heights[i + 1];
    const eps = (b - a) * 1e-6;
    const lo = intervalsAt(profile, a + eps);
    const hi = intervalsAt(profile, b - eps);
    if (lo.some((iv) => iv.inner > TOL) || hi.some((iv) => iv.inner > TOL)) hollow = true;
    if (lo.length !== 1 || hi.length !== 1) {
      complex = true;
      continue;
    }
    if (Math.abs(lo[0].inner - hi[0].inner) > TOL) constantInner = false;
    const ra = lo[0].outer;
    const rb = hi[0].outer;
    if (Math.abs(ra - rb) < TOL) parts.push('원기둥');
    else if (Math.min(ra, rb) < TOL) parts.push('원뿔');
    else parts.push('원뿔대');
  }

  if (hollow) {
    const name =
      !complex && parts.length === 1 && parts[0] === '원기둥' && constantInner
        ? '가운데가 빈 원기둥'
        : '가운데가 빈 회전체';
    return { name, parts: complex ? [] : parts, hollow };
  }
  if (complex || parts.length === 0 || parts.length > 4) {
    return { name: '회전체', parts: [], hollow };
  }
  return { name: parts.join(' + '), parts, hollow };
}
