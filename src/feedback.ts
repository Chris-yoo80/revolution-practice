/** 구글 폼 '미리 채워진 링크'에서 얻은 정보. formUrl이 비어 있으면 의견 버튼을 숨긴다. */
export interface FeedbackForm {
  /** 폼 주소(…/viewform) */
  formUrl: string;
  /** 앱 이름·버전을 넣을 칸의 entry 이름(예: 'entry.123456789'). 비우면 채우지 않음 */
  versionEntry: string;
  /** 지금 화면 이름을 넣을 칸의 entry 이름. 비우면 채우지 않음 */
  screenEntry: string;
}

export const APP_NAME = '회전체 연습';

/** 버전과 화면 이름을 미리 채운 의견 폼 주소. 폼이 설정되지 않았으면 null. */
export function feedbackLink(form: FeedbackForm, version: string, screen: string): string | null {
  if (!form.formUrl) return null;
  const url = new URL(form.formUrl);
  url.searchParams.set('usp', 'pp_url');
  if (form.versionEntry) url.searchParams.set(form.versionEntry, `${APP_NAME} v${version}`);
  if (form.screenEntry) url.searchParams.set(form.screenEntry, screen);
  return url.toString();
}
