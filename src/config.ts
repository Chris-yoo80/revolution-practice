import type { FeedbackForm } from './feedback.ts';

/** package.json의 version (빌드할 때 vite.config.ts의 define으로 넣는다) */
export const APP_VERSION: string = __APP_VERSION__;

/** 여러 수학 도구를 모아 둔 첫 화면 */
export const HUB_URL = 'https://chris-yoo80.github.io/math-tools/';

/**
 * 의견 보내기 구글 폼. 폼을 만든 뒤 '미리 채워진 링크 가져오기'로 얻은 주소에서
 * viewform 주소와 각 칸의 entry 이름을 옮겨 적는다. formUrl이 비어 있으면 버튼이 보이지 않는다.
 */
export const FEEDBACK_FORM: FeedbackForm = {
  formUrl: '',
  versionEntry: '',
  screenEntry: '',
};
