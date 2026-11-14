import { describe, expect, it } from 'vitest';
import { feedbackLink } from '../src/feedback.ts';

const form = {
  formUrl: 'https://docs.google.com/forms/d/e/ABC/viewform',
  versionEntry: 'entry.111',
  screenEntry: 'entry.222',
};

describe('feedbackLink', () => {
  it('폼 주소가 없으면 null (버튼을 숨김)', () => {
    expect(feedbackLink({ formUrl: '', versionEntry: '', screenEntry: '' }, '1.2.0', '탐구하기')).toBeNull();
  });

  it('버전과 화면을 미리 채운 구글 폼 주소를 만든다', () => {
    const url = new URL(feedbackLink(form, '1.2.0', '탐구하기')!);
    expect(url.origin + url.pathname).toBe('https://docs.google.com/forms/d/e/ABC/viewform');
    expect(url.searchParams.get('usp')).toBe('pp_url');
    expect(url.searchParams.get('entry.111')).toBe('회전체 연습 v1.2.0');
    expect(url.searchParams.get('entry.222')).toBe('탐구하기');
  });

  it('entry 번호가 비어 있으면 그 칸은 건너뛴다', () => {
    const url = new URL(feedbackLink({ ...form, screenEntry: '' }, '1.2.0', '문제 풀기')!);
    expect(url.searchParams.has('entry.222')).toBe(false);
    expect(url.searchParams.get('entry.111')).toBe('회전체 연습 v1.2.0');
  });
});
