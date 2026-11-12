import { describe, expect, it } from 'vitest';
import { validateRing } from '../../src/geometry/validate.ts';

describe('validateRing', () => {
  it('정상 삼각형', () => expect(validateRing([[0, 0], [2, 0], [2, 2]])).toBe('ok'));
  it('점 두 개', () => expect(validateRing([[0, 0], [2, 0]])).toBe('too-few'));
  it('일직선', () => expect(validateRing([[0, 0], [1, 0], [2, 0]])).toBe('zero-area'));
  it('나비넥타이 모양은 자기 교차', () => expect(validateRing([[0, 0], [2, 2], [2, 0], [0, 2]])).toBe('self-intersect'));
});
