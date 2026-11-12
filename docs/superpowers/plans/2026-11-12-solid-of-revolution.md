# 회전체 연습 앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 중1 '회전체' 단원 학생이 갤럭시탭에 설치해 쓰는 PWA — 평면도형을 축 둘레로 돌려 보는 탐구 모드와 자동 생성 4지선다 문제 모드.

**Architecture:** 모든 기능을 '반쪽 단면'(축 기준 r ≥ 0 다각형) 하나로 통일한다. `src/geometry`(순수 수학, 단위 테스트) → `src/quiz`(문제·오답 생성, 단위 테스트) → `src/render`(Three.js 3D, Canvas 2D) → `src/editor`(모눈 작업판) → `src/ui`(화면). 정적 빌드 + 서비스 워커로 오프라인 동작.

**Tech Stack:** Vite 8, TypeScript 5.9, Three.js 0.187, polygon-clipping 0.15, vite-plugin-pwa 2, Vitest 5.

**설계 문서:** `docs/superpowers/specs/2026-11-12-solid-of-revolution-design.md`

> 이 계획의 코드는 2026-11-12에 임시 폴더 시제품으로 먼저 작성해 타입 검사, `vite build`, Vitest 44개 테스트, 실제 Chrome 화면(1280×800, 800×1280)으로 확인한 것을 그대로 옮겼다.

## Global Constraints

- 주 기기: 갤럭시탭(안드로이드 크롬), 가로·세로 모두 지원. 기준 1280×800 CSS px.
- 배포: PWA(`display: standalone`, `orientation: any`, 오프라인 동작, `registerType: autoUpdate`), GitHub Pages, `base: './'`.
- 터치 영역 최소 48px(`--tap: 48px`). 캔버스는 `touch-action: none`. 페이지 확대 금지(`maximum-scale=1`).
- 3D 픽셀 비율 최대 2. 회전 분할 64.
- 로그인·서버 없음. 최고 기록만 localStorage(`revolution.best.<mode>-<difficulty>`).
- import는 `.ts` 확장자를 붙인다(`allowImportingTsExtensions`). `erasableSyntaxOnly`: 생성자 매개변수 속성·enum 금지.
- rollup은 `@rollup/wasm-node`로 override(Windows 애플리케이션 제어가 rollup 네이티브 바이너리를 막음).
- 화면 문구는 한국어, 학생에게 존댓말(해요체).
- 한 문제의 보기 4개는 서로 다른 회전체/단면이어야 한다(`sameProfile`/`sameSection`으로 검증).

---

### Task 1: 프로젝트 골격 (Vite + TS + PWA 설정)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `public/icon.svg`

**Interfaces:**
- Produces: `npm run dev|build|preview|test|typecheck|icons` 스크립트, `.ts` 확장자 import 허용(`allowImportingTsExtensions`), `vitest`는 `tests/**/*.test.ts`만 실행.

> `src/main.ts`는 Task 9에서 만든다. 이 작업에서는 빌드 확인용으로 임시 `src/main.ts`에 `export {};` 한 줄만 둔다(Task 9에서 덮어씀).

- [ ] **Step 1: `package.json` 작성**

```json
{
  "name": "revolution-practice",
  "private": true,
  "version": "1.0.0",
  "description": "중1 도형 회전체 연습 앱 (PWA)",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p . && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc -p .",
    "icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
  },
  "dependencies": {
    "polygon-clipping": "^0.15.7",
    "three": "^0.187.0"
  },
  "devDependencies": {
    "@types/three": "^0.187.0",
    "@vite-pwa/assets-generator": "^2.0.0",
    "typescript": "^5.9.3",
    "vite": "^8.3.8",
    "vite-plugin-pwa": "^2.0.0",
    "vitest": "^5.1.0"
  },
  "overrides": {
    "rollup": "npm:@rollup/wasm-node@4.68.2"
  }
}
```

- [ ] **Step 2: `tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: `vite.config.ts` 작성**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // 상대 경로: GitHub Pages 하위 경로(/저장소이름/)에서도 그대로 동작
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '회전체 연습',
        short_name: '회전체',
        description: '평면도형을 회전축 둘레로 돌려 회전체를 만들어 보는 중1 도형 연습 앱',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f7fb',
        theme_color: '#3b6fe0',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: `index.html` 작성**

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#3b6fe0" />
    <meta name="description" content="평면도형을 회전축 둘레로 돌려 회전체를 만들어 보는 중1 도형 연습 앱" />
    <link rel="icon" href="favicon.ico" sizes="48x48" />
    <link rel="icon" href="icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="apple-touch-icon-180x180.png" />
    <title>회전체 연습</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: `.gitignore` 작성**

```text
node_modules
dist
dev-dist
*.log
.omc
```

- [ ] **Step 6: `public/icon.svg` 작성**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#3b6fe0"/>
  <line x1="200" y1="72" x2="200" y2="440" stroke="#ff5a5f" stroke-width="14" stroke-dasharray="36 14 8 14"/>
  <ellipse cx="300" cy="370" rx="100" ry="30" fill="#2a54b8"/>
  <path d="M200 120 L300 370 L200 370 Z" fill="#ff8a3d"/>
  <path d="M200 120 L100 370 A100 30 0 0 0 300 370 Z" fill="#ffffff" fill-opacity="0.35"/>
  <path d="M330 140 A60 22 0 1 1 250 128" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/>
  <path d="M236 116 L262 106 L258 140 Z" fill="#ffffff"/>
</svg>
```

- [ ] **Step 7: 의존성 설치**

```bash
npm install
```
예상: 오류 없이 끝남. `node_modules/rollup/package.json`의 name이 `@rollup/wasm-node`여야 한다(Windows 애플리케이션 제어가 rollup 네이티브 .node 파일을 막는 문제 회피).

- [ ] **Step 8: 아이콘 생성**

```bash
npm run icons
```
예상: `public/`에 `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico` 생성.

- [ ] **Step 9: 빌드 확인**

```bash
npm run build
```
예상: `✓ built`, `PWA v2.0.0 … files generated dist/sw.js`.

- [ ] **Step 10: 커밋**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore public src/main.ts
git commit -m "chore: Vite + TypeScript + PWA 프로젝트 골격"
```

---

### Task 2: 기하 기초: 다각형 연산, 반쪽 단면, 프리셋 도형

**Files:**
- Create: `src/geometry/types.ts`
- Create: `src/geometry/polygon.ts`
- Create: `src/geometry/profile.ts`
- Create: `src/geometry/shapes.ts`
- Test: `tests/geometry/profile.test.ts`

**Interfaces:**
- Produces (types.ts): `Vec2=[number,number]`, `Ring=Vec2[]`(닫는 점 반복 없음), `Polygon=Ring[]`, `MultiPolygon=Polygon[]`, `Axis={dir:'vertical'|'horizontal';pos:number}`, `Figure={pieces:Ring[];axis:Axis}`, `HalfProfile=MultiPolygon`(좌표 [r,h]), `Cut={kind:'axial'}|{kind:'perpendicular';h:number}`.
- Produces (polygon.ts): `union(...mp)`, `intersection(a,b)`, `ringsToMulti(rings)`, `signedArea(ring)`, `polygonArea`, `multiArea`, `mapPoints(mp,f)`, `bbox(mp)→{minX,minY,maxX,maxY}`, `rect(minX,minY,maxX,maxY)`.
- Produces (profile.ts): `toAxisPoint(p,axis)`, `fromAxisPoint(q,axis)`, `figureInAxisFrame(figure):Ring[]`, `foldToHalf(mp):HalfProfile`, `halfProfile(figure):HalfProfile`.
- Produces (shapes.ts): `rectangle(x,y,w,h)`, `semicircle(cx,cy,r,facing)`, `quarterCircle(cx,cy,r,startAngle)`, `circle(cx,cy,r)`, `PRESETS: Preset[]` (`{id,label,figure,editable}`; id: rect, tri, trap, semi, circle, cyl-cone, off-rect, stairs).

**주의할 점 (시제품에서 확인함):**
- polygon-clipping은 결과 고리 끝에 첫 점을 반복하므로 `openRing`으로 제거한다.
- 부동소수 오차로 polygon-clipping이 "Unable to complete output ring" 예외를 던지는 일이 있어 입력 좌표를 10⁻⁶ 단위로 맞춘다(`snap`).
- 접을 때 `-r` 대신 `Math.abs(r)`를 써야 `-0`이 생기지 않는다(테스트가 `toEqual`로 0을 비교함).

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/geometry/profile.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { bbox } from '../../src/geometry/polygon.ts';
import { halfProfile } from '../../src/geometry/profile.ts';
import { rectangle } from '../../src/geometry/shapes.ts';
import type { Axis } from '../../src/geometry/types.ts';

const vAxis: Axis = { dir: 'vertical', pos: 0 };

describe('halfProfile', () => {
  it('축에 붙은 직사각형은 그대로 반쪽 단면이 된다', () => {
    const hp = halfProfile({ pieces: [rectangle(0, 0, 3, 5)], axis: vAxis });
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 5 });
  });

  it('축이 가로지르면 더 넓은 쪽으로 접힌다', () => {
    const hp = halfProfile({ pieces: [rectangle(-1, 0, 3, 4)], axis: vAxis });
    expect(hp).toHaveLength(1);
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 4 });
  });

  it('축에서 떨어진 도형은 r 최솟값이 0보다 크다', () => {
    const hp = halfProfile({ pieces: [rectangle(2, 0, 1, 3)], axis: vAxis });
    expect(bbox(hp).minX).toBe(2);
  });

  it('가로축이면 y가 축까지 거리, x가 축 방향 위치가 된다', () => {
    const hp = halfProfile({ pieces: [rectangle(0, 0, 5, 2)], axis: { dir: 'horizontal', pos: 0 } });
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 5 });
  });

  it('축 왼쪽에만 있는 도형도 오른쪽으로 뒤집힌다', () => {
    const hp = halfProfile({ pieces: [rectangle(-3, 0, 3, 2)], axis: vAxis });
    expect(bbox(hp)).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 2 });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run tests/geometry/profile.test.ts
```
예상: FAIL (아직 없는 모듈을 import하므로 "Failed to resolve import" 또는 "Cannot find module").

- [ ] **Step 3: `src/geometry/types.ts` 작성**

```ts
/** 2D 점 [x, y]. 반쪽 단면에서는 [r, h] (r = 축까지 거리, h = 축 방향 위치). */
export type Vec2 = [number, number];
/** 닫힌 다각형 고리. 마지막 점은 첫 점을 반복하지 않는다. */
export type Ring = Vec2[];
/** [바깥 고리, ...구멍 고리] */
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

export type AxisDir = 'vertical' | 'horizontal';
/** vertical: 직선 x = pos, horizontal: 직선 y = pos */
export interface Axis {
  dir: AxisDir;
  pos: number;
}

/** 학생이 보는 평면도형(모눈 좌표) + 회전축. pieces는 서로 붙어 있을 수 있는 단순 다각형들. */
export interface Figure {
  pieces: Ring[];
  axis: Axis;
}

/** 반쪽 단면: r ≥ 0 영역의 다각형 집합. 좌표는 [r, h]. */
export type HalfProfile = MultiPolygon;

/** 회전체를 자르는 평면. axial: 회전축을 포함, perpendicular: 회전축에 수직(높이 h). */
export type Cut = { kind: 'axial' } | { kind: 'perpendicular'; h: number };
```

- [ ] **Step 4: `src/geometry/polygon.ts` 작성**

```ts
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon, Ring, Vec2 } from './types.ts';

/** polygon-clipping 결과의 닫는 점(첫 점 반복)을 제거한다. */
function openRing(ring: Vec2[]): Ring {
  const n = ring.length;
  if (n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1]) {
    return ring.slice(0, n - 1).map((p) => [p[0], p[1]] as Vec2);
  }
  return ring.map((p) => [p[0], p[1]] as Vec2);
}

function clean(mp: Vec2[][][]): MultiPolygon {
  return mp.map((poly) => poly.map(openRing));
}

/** 부동소수 오차로 polygon-clipping이 실패하지 않도록 좌표를 10⁻⁶ 단위로 맞춘다. */
function snap(mp: MultiPolygon): MultiPolygon {
  const q = (v: number) => Math.round(v * 1e6) / 1e6;
  return mp.map((poly) => poly.map((ring) => ring.map(([x, y]) => [q(x), q(y)] as Vec2)));
}

export function union(...geoms: MultiPolygon[]): MultiPolygon {
  const nonEmpty = geoms.filter((g) => g.length > 0).map(snap);
  if (nonEmpty.length === 0) return [];
  const [first, ...rest] = nonEmpty;
  return clean(polygonClipping.union(first, ...rest));
}

export function intersection(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (a.length === 0 || b.length === 0) return [];
  return clean(polygonClipping.intersection(snap(a), snap(b)));
}

export function ringsToMulti(rings: Ring[]): MultiPolygon {
  return rings.map((r) => [r]);
}

/** 부호 있는 넓이(반시계 +). */
export function signedArea(ring: Ring): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function polygonArea(poly: Polygon): number {
  const [outer, ...holes] = poly;
  return Math.abs(signedArea(outer)) - holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
}

export function multiArea(mp: MultiPolygon): number {
  return mp.reduce((s, p) => s + polygonArea(p), 0);
}

export function mapPoints(mp: MultiPolygon, f: (p: Vec2) => Vec2): MultiPolygon {
  return mp.map((poly) => poly.map((ring) => ring.map(f)));
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bbox(mp: MultiPolygon): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of mp) for (const ring of poly) for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** 축에 평행한 큰 직사각형. 접기·자르기에 사용. */
export function rect(minX: number, minY: number, maxX: number, maxY: number): MultiPolygon {
  return [[[[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]]];
}
```

- [ ] **Step 5: `src/geometry/profile.ts` 작성**

```ts
import { intersection, mapPoints, rect, ringsToMulti, union } from './polygon.ts';
import type { Axis, Figure, HalfProfile, MultiPolygon, Ring, Vec2 } from './types.ts';

const BIG = 1e4;

/** 모눈 좌표 → 축 좌표 [r(부호 있음), h]. */
export function toAxisPoint(p: Vec2, axis: Axis): Vec2 {
  return axis.dir === 'vertical' ? [p[0] - axis.pos, p[1]] : [p[1] - axis.pos, p[0]];
}

/** 축 좌표 → 모눈 좌표 (toAxisPoint의 역변환). */
export function fromAxisPoint(q: Vec2, axis: Axis): Vec2 {
  return axis.dir === 'vertical' ? [q[0] + axis.pos, q[1]] : [q[1], q[0] + axis.pos];
}

/** 도형 조각들을 축 좌표로 바꾼 고리 목록(접기 전, r이 음수일 수 있음). */
export function figureInAxisFrame(figure: Figure): Ring[] {
  return figure.pieces.map((ring) => ring.map((p) => toAxisPoint(p, figure.axis)));
}

/** 축 좌표 다각형을 축(r = 0) 기준으로 접어 반쪽 단면을 만든다. */
export function foldToHalf(shape: MultiPolygon): HalfProfile {
  const merged = union(shape);
  const pos = intersection(merged, rect(0, -BIG, BIG, BIG));
  const neg = intersection(merged, rect(-BIG, -BIG, 0, BIG));
  const negFlipped = mapPoints(neg, ([r, h]) => [Math.abs(r), h]); // abs: -0 대신 0
  return union(pos, negFlipped);
}

export function halfProfile(figure: Figure): HalfProfile {
  return foldToHalf(ringsToMulti(figureInAxisFrame(figure)));
}
```

- [ ] **Step 6: `src/geometry/shapes.ts` 작성**

```ts
import type { Figure, Ring, Vec2 } from './types.ts';

export function rectangle(x: number, y: number, w: number, h: number): Ring {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** 지름이 점 (cx, cy)를 지나는 반원. facing 쪽으로 볼록하다. */
export function semicircle(
  cx: number,
  cy: number,
  radius: number,
  facing: 'right' | 'left' | 'up' | 'down',
  segments = 32,
): Ring {
  const start = { right: -Math.PI / 2, up: 0, left: Math.PI / 2, down: Math.PI }[facing];
  const ring: Ring = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (i / segments) * Math.PI;
    ring.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

/** 꼭짓점 (cx, cy)에서 startAngle부터 90° 펼쳐진 사분원. */
export function quarterCircle(cx: number, cy: number, radius: number, startAngle: number, segments = 16): Ring {
  const ring: Ring = [[cx, cy]];
  for (let i = 0; i <= segments; i++) {
    const a = startAngle + (i / segments) * (Math.PI / 2);
    ring.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

export function circle(cx: number, cy: number, radius: number, segments = 48): Ring {
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

export interface Preset {
  id: string;
  label: string;
  figure: Figure;
  /** 곡선 도형은 꼭짓점 편집을 막는다. */
  editable: boolean;
}

const vAxis = { dir: 'vertical' as const, pos: 0 };

export const PRESETS: Preset[] = [
  { id: 'rect', label: '직사각형', editable: true, figure: { pieces: [rectangle(0, 0, 3, 5)], axis: vAxis } },
  { id: 'tri', label: '직각삼각형', editable: true, figure: { pieces: [[[0, 0], [3, 0], [0, 5]]], axis: vAxis } },
  { id: 'trap', label: '사다리꼴', editable: true, figure: { pieces: [[[0, 0], [4, 0], [2, 4], [0, 4]]], axis: vAxis } },
  { id: 'semi', label: '반원', editable: false, figure: { pieces: [semicircle(0, 3, 3, 'right')], axis: vAxis } },
  { id: 'circle', label: '원 (축에서 떨어짐)', editable: false, figure: { pieces: [circle(3, 3, 1.5)], axis: vAxis } },
  {
    id: 'cyl-cone',
    label: '직사각형 + 삼각형',
    editable: true,
    figure: { pieces: [rectangle(0, 0, 3, 3), [[0, 3], [3, 3], [0, 6]]], axis: vAxis },
  },
  { id: 'off-rect', label: '축에서 떨어진 직사각형', editable: true, figure: { pieces: [rectangle(1, 0, 2, 4)], axis: vAxis } },
  {
    id: 'stairs',
    label: '계단 모양',
    editable: true,
    figure: { pieces: [rectangle(0, 0, 4, 2), rectangle(0, 2, 2, 3)], axis: vAxis },
  },
];
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
npx vitest run tests/geometry/profile.test.ts && npm run typecheck
```
예상: 모든 테스트 PASS, 타입 오류 없음.

- [ ] **Step 8: 커밋**

```bash
git add src/geometry/types.ts src/geometry/polygon.ts src/geometry/profile.ts src/geometry/shapes.ts tests/geometry/profile.test.ts
git commit -m "feat: 반쪽 단면과 프리셋 도형"
```

---

### Task 3: 단면 계산과 회전체 이름 판별

**Files:**
- Create: `src/geometry/sections.ts`
- Create: `src/geometry/classify.ts`
- Test: `tests/geometry/sections.test.ts`
- Test: `tests/geometry/classify.test.ts`

**Interfaces:**
- Consumes: Task 2의 `halfProfile`, `union`, `mapPoints`, `PRESETS`.
- Produces (sections.ts): `Annulus={inner,outer}`, `axialSection(profile):MultiPolygon`, `intervalsAt(profile,h):Annulus[]`, `perpendicularSection(profile,h):Annulus[]`, `circleRing(r)`, `annuliToShape(annuli):MultiPolygon`, `safeCutHeights(profile):number[]`.
- Produces (classify.ts): `classify(profile):{name:string;parts:SolidPart[];hollow:boolean}` — 이름 예: "원기둥", "원기둥 + 원뿔", "구", "가운데가 빈 원기둥", "가운데가 빈 회전체", "회전체".

**주의할 점 (시제품에서 확인함):**
- `intervalsAt`은 반개구간 규칙(아래 끝점 포함, 위 끝점 제외)으로 꼭짓점을 두 번 세지 않는다.
- 판별은 꼭짓점 높이로 나눈 띠(slab)마다 바깥 반지름이 같으면 원기둥, 한쪽이 0이면 원뿔, 아니면 원뿔대로 본다. 구는 모든 점이 축 위 중심에서 같은 거리인지로 먼저 확인한다.

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/geometry/sections.test.ts`**

```ts
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
```

- [ ] **Step 2: 실패하는 테스트 작성 — `tests/geometry/classify.test.ts`**

```ts
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
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
npx vitest run tests/geometry/sections.test.ts tests/geometry/classify.test.ts
```
예상: FAIL (아직 없는 모듈을 import하므로 "Failed to resolve import" 또는 "Cannot find module").

- [ ] **Step 4: `src/geometry/sections.ts` 작성**

```ts
import { mapPoints, union } from './polygon.ts';
import type { HalfProfile, MultiPolygon, Ring, Vec2 } from './types.ts';

export interface Annulus {
  inner: number;
  outer: number;
}

/** 회전축을 포함하는 평면으로 자른 단면. 좌표 [x, h], x = ±r. */
export function axialSection(profile: HalfProfile): MultiPolygon {
  return union(profile, mapPoints(profile, ([r, h]) => [-r, h]));
}

const EPS = 1e-9;

/** 반쪽 단면이 높이 h에서 차지하는 r 구간들. 짝-홀 규칙으로 계산한다. */
export function intervalsAt(profile: HalfProfile, h: number): Annulus[] {
  const xs: number[] = [];
  for (const poly of profile) for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const [r1, h1] = ring[i];
      const [r2, h2] = ring[(i + 1) % ring.length];
      // 반개구간 규칙: 아래 끝점 포함, 위 끝점 제외 → 꼭짓점 중복 계산 방지
      if ((h1 <= h && h < h2) || (h2 <= h && h < h1)) {
        xs.push(r1 + ((h - h1) / (h2 - h1)) * (r2 - r1));
      }
    }
  }
  xs.sort((a, b) => a - b);
  const out: Annulus[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    const inner = Math.abs(xs[i]) < EPS ? 0 : xs[i];
    const outer = xs[i + 1];
    const last = out[out.length - 1];
    if (last && Math.abs(last.outer - inner) < EPS) last.outer = outer;
    else out.push({ inner, outer });
  }
  return out;
}

/** 회전축에 수직인 평면(높이 h)으로 자른 단면의 원·고리 목록. */
export function perpendicularSection(profile: HalfProfile, h: number): Annulus[] {
  return intervalsAt(profile, h);
}

export function circleRing(radius: number, segments = 64): Ring {
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([radius * Math.cos(a), radius * Math.sin(a)] as Vec2);
  }
  return ring;
}

/** 원·고리 목록을 2D 다각형(중심 원점)으로 바꾼다. 그리기·비교용. */
export function annuliToShape(annuli: Annulus[]): MultiPolygon {
  return annuli.map(({ inner, outer }) =>
    inner > 0 ? [circleRing(outer), circleRing(inner).reverse()] : [circleRing(outer)],
  );
}

/** 높이 h가 단면 계산에 안전하도록 꼭짓점 높이들 사이의 중간값 목록을 돌려준다. */
export function safeCutHeights(profile: HalfProfile): number[] {
  const hs = new Set<number>();
  for (const poly of profile) for (const ring of poly) for (const [, h] of ring) hs.add(h);
  const sorted = [...hs].sort((a, b) => a - b);
  const mids: number[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) mids.push((sorted[i] + sorted[i + 1]) / 2);
  return mids;
}
```

- [ ] **Step 5: `src/geometry/classify.ts` 작성**

```ts
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
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx vitest run tests/geometry/sections.test.ts tests/geometry/classify.test.ts && npm run typecheck
```
예상: 모든 테스트 PASS, 타입 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/geometry/sections.ts src/geometry/classify.ts tests/geometry/sections.test.ts tests/geometry/classify.test.ts
git commit -m "feat: 회전체 단면 계산과 이름 판별"
```

---

### Task 4: 같은 회전체 비교와 그린 도형 검사

**Files:**
- Create: `src/geometry/equality.ts`
- Create: `src/geometry/validate.ts`
- Test: `tests/geometry/equality.test.ts`
- Test: `tests/geometry/validate.test.ts`

**Interfaces:**
- Produces (equality.ts): `sameShape(a,b,{normalizeX,allowFlipY})`, `sameProfile(a,b)`(축 방향 이동·뒤집기 무시, r은 유지), `sameSection(a,b)`(위치 무시, 위아래 뒤집기 허용).
- Produces (validate.ts): `validateRing(ring): 'ok'|'too-few'|'zero-area'|'self-intersect'`, `segmentsIntersect`.

**주의할 점 (시제품에서 확인함):**
- 비교는 polygon-clipping의 xor 대신 64×64 격자 스캔라인 표본으로 한다. xor는 원 근사 다각형끼리 비교할 때 예외를 던졌고, 점마다 다각형 안팎을 검사하는 방식은 너무 느렸다(문제 하나에 80ms 이상). 스캔라인은 문제 하나에 5~15ms.
- 자기 교차 검사를 넓이 검사보다 먼저 해야 나비넥타이 모양(넓이 0)이 self-intersect로 나온다.

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/geometry/equality.test.ts`**

```ts
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
```

- [ ] **Step 2: 실패하는 테스트 작성 — `tests/geometry/validate.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { validateRing } from '../../src/geometry/validate.ts';

describe('validateRing', () => {
  it('정상 삼각형', () => expect(validateRing([[0, 0], [2, 0], [2, 2]])).toBe('ok'));
  it('점 두 개', () => expect(validateRing([[0, 0], [2, 0]])).toBe('too-few'));
  it('일직선', () => expect(validateRing([[0, 0], [1, 0], [2, 0]])).toBe('zero-area'));
  it('나비넥타이 모양은 자기 교차', () => expect(validateRing([[0, 0], [2, 2], [2, 0], [0, 2]])).toBe('self-intersect'));
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
npx vitest run tests/geometry/equality.test.ts tests/geometry/validate.test.ts
```
예상: FAIL (아직 없는 모듈을 import하므로 "Failed to resolve import" 또는 "Cannot find module").

- [ ] **Step 4: `src/geometry/equality.ts` 작성**

```ts
import { bbox, mapPoints } from './polygon.ts';
import type { HalfProfile, MultiPolygon } from './types.ts';

export interface SameShapeOptions {
  /** x 방향 평행이동을 무시할지. 반쪽 단면은 r(축까지 거리)이 의미가 있으므로 false. */
  normalizeX: boolean;
  /** 위아래 뒤집기를 같은 모양으로 볼지. */
  allowFlipY: boolean;
}

const GRID = 64;
/** 표본점이 정수 좌표 경계선 위에 떨어지지 않도록 하는 작은 어긋남 */
const JITTER = 0.0137;

function normalize(mp: MultiPolygon, normalizeX: boolean): MultiPolygon {
  const b = bbox(mp);
  const dx = normalizeX ? b.minX : 0;
  return mapPoints(mp, ([x, y]) => [x - dx, y - b.minY]);
}

function flipY(mp: MultiPolygon): MultiPolygon {
  const b = bbox(mp);
  return mapPoints(mp, ([x, y]) => [x, b.maxY + b.minY - y]);
}

/** 스캔라인으로 GRID×GRID 표본 격자를 채운다(짝-홀 규칙). */
function rasterize(mp: MultiPolygon, minX: number, minY: number, step: number): Uint8Array {
  const cells = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) {
    const y = minY + (j + 0.5 + JITTER) * step;
    const xs: number[] = [];
    for (const poly of mp) for (const ring of poly) {
      for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
        const [xi, yi] = ring[i];
        const [xk, yk] = ring[k];
        if (yi > y !== yk > y) xs.push(xi + ((y - yi) / (yk - yi)) * (xk - xi));
      }
    }
    xs.sort((p, q) => p - q);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      const from = Math.max(0, Math.ceil((xs[m] - minX) / step - 0.5 - JITTER));
      const to = Math.min(GRID - 1, Math.floor((xs[m + 1] - minX) / step - 0.5 - JITTER));
      for (let i = from; i <= to; i++) cells[j * GRID + i] ^= 1;
    }
  }
  return cells;
}

/** 두 도형을 같은 격자 위에 찍어 보고, 안/밖이 다른 표본이 1% 이하이면 같다고 본다. */
function nearlyEqual(a: MultiPolygon, b: MultiPolygon): boolean {
  const ba = bbox(a);
  const bb = bbox(b);
  const minX = Math.min(ba.minX, bb.minX);
  const minY = Math.min(ba.minY, bb.minY);
  const size = Math.max(Math.max(ba.maxX, bb.maxX) - minX, Math.max(ba.maxY, bb.maxY) - minY);
  if (size === 0) return true;
  const step = size / GRID;
  const ra = rasterize(a, minX, minY, step);
  const rb = rasterize(b, minX, minY, step);
  let diff = 0;
  let inA = 0;
  let inB = 0;
  for (let i = 0; i < ra.length; i++) {
    inA += ra[i];
    inB += rb[i];
    if (ra[i] !== rb[i]) diff++;
  }
  return diff <= Math.max(inA, inB) * 0.01;
}

export function sameShape(a: MultiPolygon, b: MultiPolygon, opts: SameShapeOptions): boolean {
  if (a.length === 0 || b.length === 0) return a.length === b.length;
  const na = normalize(a, opts.normalizeX);
  const nb = normalize(b, opts.normalizeX);
  if (nearlyEqual(na, nb)) return true;
  return opts.allowFlipY && nearlyEqual(na, flipY(nb));
}

/** 두 반쪽 단면이 같은 회전체를 만드는지. 축 방향 평행이동·뒤집기는 같은 회전체로 본다. */
export function sameProfile(a: HalfProfile, b: HalfProfile): boolean {
  return sameShape(a, b, { normalizeX: false, allowFlipY: true });
}

/** 2D 단면 그림이 같은지. 위치는 무시하고 위아래 뒤집기는 같은 것으로 본다. */
export function sameSection(a: MultiPolygon, b: MultiPolygon): boolean {
  return sameShape(a, b, { normalizeX: true, allowFlipY: true });
}
```

- [ ] **Step 5: `src/geometry/validate.ts` 작성**

```ts
import { signedArea } from './polygon.ts';
import type { Ring, Vec2 } from './types.ts';

export type RingProblem = 'ok' | 'too-few' | 'zero-area' | 'self-intersect';

function orient(a: Vec2, b: Vec2, c: Vec2): number {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return Math.abs(v) < 1e-12 ? 0 : Math.sign(v);
}

function onSegment(a: Vec2, b: Vec2, p: Vec2): boolean {
  return (
    Math.min(a[0], b[0]) <= p[0] && p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] && p[1] <= Math.max(a[1], b[1])
  );
}

export function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  const o1 = orient(p1, p2, q1);
  const o2 = orient(p1, p2, q2);
  const o3 = orient(q1, q2, p1);
  const o4 = orient(q1, q2, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, p2, q2)) return true;
  if (o3 === 0 && onSegment(q1, q2, p1)) return true;
  if (o4 === 0 && onSegment(q1, q2, p2)) return true;
  return false;
}

/** 학생이 그린 다각형이 회전시킬 수 있는 단순 다각형인지 검사한다. */
export function validateRing(ring: Ring): RingProblem {
  if (ring.length < 3) return 'too-few';
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;
      if (segmentsIntersect(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) {
        return 'self-intersect';
      }
    }
  }
  if (Math.abs(signedArea(ring)) < 1e-9) return 'zero-area';
  return 'ok';
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx vitest run tests/geometry/equality.test.ts tests/geometry/validate.test.ts && npm run typecheck
```
예상: 모든 테스트 PASS, 타입 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add src/geometry/equality.ts src/geometry/validate.ts tests/geometry/equality.test.ts tests/geometry/validate.test.ts
git commit -m "feat: 회전체 비교와 그린 도형 검사"
```

---

### Task 5: 문제 생성기와 오답 규칙

**Files:**
- Create: `src/quiz/rng.ts`
- Create: `src/quiz/types.ts`
- Create: `src/quiz/figures.ts`
- Create: `src/quiz/distractors.ts`
- Create: `src/quiz/generator.ts`
- Test: `tests/quiz/generator.test.ts`

**Interfaces:**
- Consumes: Task 2~4의 기하 함수 전부.
- Produces (rng.ts): `Rng=()=>number`, `mulberry32(seed)`, `randInt(rng,min,max)`, `pick(rng,items)`, `shuffle(rng,items)`.
- Produces (types.ts): `QuizType='A'|'B'|'C'`, `Visual`(figure | solid | prism | section | solid-cut), `Choice={visual;why}`, `Question={type;prompt;question;choices;answerIndex;source}`, `Cut` 재수출.
- Produces (figures.ts): `Difficulty='basic'|'advanced'`, `randomFigure(difficulty,rng):Figure`.
- Produces (distractors.ts): `WHY`(해설 문구), `alternativeAxes`, `mirroredFigure`, `shiftedFigure`, `filledProfile`, `minRadius`, `solidCandidates(figure):Choice[]`, `figureCandidates(figure):Choice[]`, `sectionCandidates(figure,cut,rng):Choice[][]`(핵심/나머지 두 묶음), `sectionOf(profile,cut)`, `fillerChoice(kind,other,cut,rng)`.
- Produces (generator.ts): `PROMPTS`, `generateQuestion(type,difficulty,rng):Question`.

**주의할 점 (시제품에서 확인함):**
- 유형 C에서 핵심 오답(가운데 빈/채움 혼동, 다른 높이, 반쪽만)을 먼저 뽑는다. 그렇지 않으면 "수직 단면 = 원이 하나뿐인 보기"가 되어 모양만 보고 맞힐 수 있다.
- 각기둥(prism) 보기는 회전체가 아니라 비교 없이 받아들이되 한 문제에 하나만.
- 보기 비교용 반쪽 단면은 `WeakMap`에 캐시한다(유형 B에서 같은 도형을 여러 번 접지 않도록).

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/quiz/generator.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { sameProfile, sameSection } from '../../src/geometry/equality.ts';
import { halfProfile } from '../../src/geometry/profile.ts';
import type { MultiPolygon } from '../../src/geometry/types.ts';
import type { Difficulty } from '../../src/quiz/figures.ts';
import { generateQuestion } from '../../src/quiz/generator.ts';
import { mulberry32 } from '../../src/quiz/rng.ts';
import type { Choice, QuizType } from '../../src/quiz/types.ts';

function key(c: Choice): MultiPolygon | null {
  const v = c.visual;
  if (v.kind === 'solid') return v.profile;
  if (v.kind === 'figure') return halfProfile(v.figure);
  if (v.kind === 'section') return v.shape;
  return null;
}

const cases: [QuizType, Difficulty][] = [
  ['A', 'basic'], ['A', 'advanced'],
  ['B', 'basic'], ['B', 'advanced'],
  ['C', 'basic'], ['C', 'advanced'],
];

describe('generateQuestion', () => {
  it.each(cases)('유형 %s / %s: 보기 4개, 정답 1개, 서로 다른 보기', (type, difficulty) => {
    const rng = mulberry32(2026);
    for (let i = 0; i < 150; i++) {
      const q = generateQuestion(type, difficulty, rng);
      expect(q.choices).toHaveLength(4);
      expect(q.choices[q.answerIndex].why).toBe('');
      q.choices.forEach((c, j) => {
        if (j !== q.answerIndex) expect(c.why).not.toBe('');
      });
      expect(q.choices.filter((c) => c.visual.kind === 'prism').length).toBeLessThanOrEqual(1);
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        const ka = key(q.choices[a]);
        const kb = key(q.choices[b]);
        if (!ka || !kb) continue;
        expect(type === 'C' ? sameSection(ka, kb) : sameProfile(ka, kb)).toBe(false);
      }
    }
  }, 60_000);

  it('같은 시드면 같은 문제', () => {
    const a = generateQuestion('A', 'basic', mulberry32(7));
    const b = generateQuestion('A', 'basic', mulberry32(7));
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run tests/quiz/generator.test.ts
```
예상: FAIL (아직 없는 모듈을 import하므로 "Failed to resolve import" 또는 "Cannot find module").

- [ ] **Step 3: `src/quiz/rng.ts` 작성**

```ts
/** 0 이상 1 미만 난수 함수. 테스트에서는 시드 고정 난수를 넣는다. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** [min, max] 정수 */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 4: `src/quiz/types.ts` 작성**

```ts
import type { Cut, Figure, HalfProfile, MultiPolygon } from '../geometry/types.ts';

export type { Cut };

export type QuizType = 'A' | 'B' | 'C';

/** 화면에 그릴 그림 한 장의 설명. 그리는 일은 render/ 가 맡는다. */
export type Visual =
  | { kind: 'figure'; figure: Figure }
  | { kind: 'solid'; profile: HalfProfile }
  | { kind: 'prism'; figure: Figure }
  | { kind: 'section'; shape: MultiPolygon }
  | { kind: 'solid-cut'; profile: HalfProfile; cut: Cut };

export interface Choice {
  visual: Visual;
  /** 이 보기를 골랐을 때 보여줄 해설. 정답이면 빈 문자열. */
  why: string;
}

export interface Question {
  type: QuizType;
  prompt: string;
  question: Visual;
  choices: Choice[];
  answerIndex: number;
  /** 해설 애니메이션에 쓰는 원래 도형 */
  source: Figure;
}
```

- [ ] **Step 5: `src/quiz/figures.ts` 작성**

```ts
import { quarterCircle, rectangle, semicircle } from '../geometry/shapes.ts';
import type { Figure, Ring, Vec2 } from '../geometry/types.ts';
import { pick, randInt, type Rng } from './rng.ts';

export type Difficulty = 'basic' | 'advanced';

/** 세로축 x = 0 기준으로 만든 조각들. */
type Builder = (rng: Rng) => Ring[];

const basic: Builder[] = [
  (rng) => [rectangle(0, 0, randInt(rng, 2, 5), randInt(rng, 2, 6))],
  (rng) => {
    const w = randInt(rng, 2, 5);
    const h = randInt(rng, 2, 6);
    return [rng() < 0.5 ? [[0, 0], [w, 0], [0, h]] : [[0, 0], [w, h], [0, h]]];
  },
  (rng) => {
    const w1 = randInt(rng, 2, 5);
    let w2 = randInt(rng, 1, 4);
    if (w2 === w1) w2 = w1 - 1;
    const h = randInt(rng, 2, 5);
    return [[[0, 0], [w1, 0], [w2, h], [0, h]]];
  },
  (rng) => {
    const r = randInt(rng, 2, 4);
    return [semicircle(0, r, r, 'right')];
  },
];

const advanced: Builder[] = [
  // 원기둥 + 원뿔
  (rng) => {
    const w = randInt(rng, 2, 4);
    const h1 = randInt(rng, 2, 4);
    const h2 = randInt(rng, 2, 3);
    return [rectangle(0, 0, w, h1), [[0, h1], [w, h1], [0, h1 + h2]]];
  },
  // 계단 모양 (원기둥 + 원기둥)
  (rng) => {
    const w1 = randInt(rng, 3, 5);
    const w2 = randInt(rng, 1, w1 - 1);
    const h1 = randInt(rng, 1, 3);
    const h2 = randInt(rng, 1, 3);
    return [rectangle(0, 0, w1, h1), rectangle(0, h1, w2, h2)];
  },
  // 축에서 떨어진 직사각형
  (rng) => [rectangle(randInt(rng, 1, 2), 0, randInt(rng, 1, 3), randInt(rng, 2, 5))],
  // 축에서 떨어진 직각삼각형
  (rng) => {
    const g = randInt(rng, 1, 2);
    const w = randInt(rng, 2, 3);
    const h = randInt(rng, 2, 5);
    return [[[g, 0], [g + w, 0], [g, h]]];
  },
  // 축이 가로지르는 직사각형
  (rng) => {
    const a = randInt(rng, 1, 3);
    let b = randInt(rng, 1, 3);
    if (b === a) b = a + 1;
    return [rectangle(-a, 0, a + b, randInt(rng, 2, 5))];
  },
  // 원기둥 + 반구
  (rng) => {
    const r = randInt(rng, 2, 3);
    const h = randInt(rng, 2, 4);
    return [rectangle(0, 0, r, h), quarterCircle(0, h, r, 0)];
  },
  // 꼭짓점이 가운데 있는 삼각형 (원뿔 + 원뿔)
  (rng) => {
    const w = randInt(rng, 2, 4);
    const h1 = randInt(rng, 1, 3);
    const h2 = randInt(rng, 1, 3);
    return [[[0, 0], [w, h1], [0, h1 + h2]]];
  },
  // 축에서 떨어진 반원 (도넛 모양 일부)
  (rng) => {
    const r = randInt(rng, 1, 2);
    return [semicircle(1, r, r, 'right')];
  },
];

/** 난이도에 맞는 무작위 도형. 절반은 가로축으로 돌려 놓는다. */
export function randomFigure(difficulty: Difficulty, rng: Rng): Figure {
  const pieces = pick(rng, difficulty === 'basic' ? basic : advanced)(rng);
  if (rng() < 0.5) {
    return { pieces, axis: { dir: 'vertical', pos: 0 } };
  }
  const swapped = pieces.map((ring) => ring.map(([x, y]) => [y, x] as Vec2));
  return { pieces: swapped, axis: { dir: 'horizontal', pos: 0 } };
}
```

- [ ] **Step 6: `src/quiz/distractors.ts` 작성**

```ts
import { bbox, mapPoints, rect, ringsToMulti, union } from '../geometry/polygon.ts';
import { figureInAxisFrame, fromAxisPoint, halfProfile } from '../geometry/profile.ts';
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

/** 도형의 바운딩 박스 네 변 중 현재 축이 아닌 축들. */
export function alternativeAxes(figure: Figure): Axis[] {
  const b = bbox(ringsToMulti(figure.pieces));
  const all: Axis[] = [
    { dir: 'vertical', pos: b.minX },
    { dir: 'vertical', pos: b.maxX },
    { dir: 'horizontal', pos: b.minY },
    { dir: 'horizontal', pos: b.maxY },
  ];
  return all.filter((a) => !(a.dir === figure.axis.dir && a.pos === figure.axis.pos));
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

function figureMinR(figure: Figure): number {
  return bbox(ringsToMulti(figureInAxisFrame(figure))).minX;
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
  const minR = figureMinR(figure);
  if (minR > 0) {
    out.push({ visual: { kind: 'figure', figure: shiftedFigure(figure, -minR) }, why: WHY.figToward });
  } else {
    out.push({ visual: { kind: 'figure', figure: shiftedFigure(figure, 1) }, why: WHY.figAway });
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
```

- [ ] **Step 7: `src/quiz/generator.ts` 작성**

```ts
import { sameProfile, sameSection } from '../geometry/equality.ts';
import { halfProfile } from '../geometry/profile.ts';
import { safeCutHeights } from '../geometry/sections.ts';
import type { Figure, HalfProfile, MultiPolygon } from '../geometry/types.ts';
import {
  figureCandidates,
  fillerChoice,
  sectionCandidates,
  sectionOf,
  solidCandidates,
} from './distractors.ts';
import { randomFigure, type Difficulty } from './figures.ts';
import { pick, shuffle, type Rng } from './rng.ts';
import type { Choice, Cut, Question, QuizType } from './types.ts';

export const PROMPTS = {
  A: '이 평면도형을 회전축 둘레로 한 바퀴 돌리면 어떤 회전체가 될까요?',
  B: '이 회전체는 어떤 평면도형을 회전축 둘레로 돌려서 만든 것일까요?',
  Caxial: '이 회전체를 회전축을 포함하는 평면으로 자르면 단면은 어떤 모양일까요?',
  Cperp: '이 회전체를 회전축에 수직인 평면으로 자르면 단면은 어떤 모양일까요?',
};

const keyCache = new WeakMap<Choice, HalfProfile | MultiPolygon | null>();

/** 보기를 비교할 때 쓰는 모양. 각기둥(prism)은 회전체가 아니므로 null. */
function compareKey(choice: Choice): HalfProfile | MultiPolygon | null {
  if (keyCache.has(choice)) return keyCache.get(choice)!;
  const v = choice.visual;
  const key =
    v.kind === 'solid' ? v.profile
    : v.kind === 'figure' ? halfProfile(v.figure)
    : v.kind === 'section' ? v.shape
    : null;
  keyCache.set(choice, key);
  return key;
}

function same(type: QuizType, a: Choice, b: Choice): boolean {
  const ka = compareKey(a);
  const kb = compareKey(b);
  if (ka === null || kb === null) return ka === null && kb === null;
  return type === 'C' ? sameSection(ka, kb) : sameProfile(ka, kb);
}

/** 후보 묶음(tier)을 앞에서부터 차례로, 묶음 안에서는 무작위 순서로 살펴 오답 3개를 고른다. */
function pickDistractors(type: QuizType, answer: Choice, tiers: Choice[][], rng: Rng): Choice[] {
  const chosen: Choice[] = [];
  for (const c of tiers.flatMap((tier) => shuffle(rng, tier))) {
    if (chosen.length === 3) break;
    if (compareKey(c) === null && chosen.some((x) => compareKey(x) === null)) continue;
    if (same(type, c, answer)) continue;
    if (chosen.some((x) => same(type, c, x))) continue;
    chosen.push(c);
  }
  return chosen;
}

function tryGenerate(type: QuizType, difficulty: Difficulty, rng: Rng): Question | null {
  const figure: Figure = randomFigure(difficulty, rng);
  const profile = halfProfile(figure);
  let cut: Cut | null = null;
  let answer: Choice;
  let candidates: Choice[][];
  let prompt: string;
  let question: Question['question'];
  let kind: 'solid' | 'figure' | 'section';

  if (type === 'A') {
    prompt = PROMPTS.A;
    question = { kind: 'figure', figure };
    answer = { visual: { kind: 'solid', profile }, why: '' };
    candidates = [solidCandidates(figure)];
    kind = 'solid';
  } else if (type === 'B') {
    prompt = PROMPTS.B;
    question = { kind: 'solid', profile };
    answer = { visual: { kind: 'figure', figure }, why: '' };
    candidates = [figureCandidates(figure)];
    kind = 'figure';
  } else {
    cut = rng() < 0.5 ? { kind: 'axial' } : { kind: 'perpendicular', h: pick(rng, safeCutHeights(profile)) };
    prompt = cut.kind === 'axial' ? PROMPTS.Caxial : PROMPTS.Cperp;
    question = { kind: 'solid-cut', profile, cut };
    answer = { visual: { kind: 'section', shape: sectionOf(profile, cut) }, why: '' };
    candidates = sectionCandidates(figure, cut, rng);
    kind = 'section';
  }

  const distractors = pickDistractors(type, answer, candidates, rng);
  for (let i = 0; i < 20 && distractors.length < 3; i++) {
    const filler = fillerChoice(kind, randomFigure(difficulty, rng), cut, rng);
    if (same(type, filler, answer) || distractors.some((d) => same(type, filler, d))) continue;
    distractors.push(filler);
  }
  if (distractors.length < 3) return null;

  const choices = shuffle(rng, [answer, ...distractors]);
  return { type, prompt, question, choices, answerIndex: choices.indexOf(answer), source: figure };
}

export function generateQuestion(type: QuizType, difficulty: Difficulty, rng: Rng): Question {
  for (let i = 0; i < 10; i++) {
    const q = tryGenerate(type, difficulty, rng);
    if (q) return q;
  }
  throw new Error(`문제를 만들지 못했어요: ${type}/${difficulty}`);
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
npx vitest run tests/quiz/generator.test.ts && npm run typecheck
```
예상: 모든 테스트 PASS, 타입 오류 없음.

- [ ] **Step 9: 커밋**

```bash
git add src/quiz/rng.ts src/quiz/types.ts src/quiz/figures.ts src/quiz/distractors.ts src/quiz/generator.ts tests/quiz/generator.test.ts
git commit -m "feat: 문제 생성기와 오답 규칙"
```

---

### Task 6: 세트 진행, 채점, 최고 기록

**Files:**
- Create: `src/quiz/session.ts`
- Test: `tests/quiz/session.test.ts`

**Interfaces:**
- Consumes: `generateQuestion`, `pick`.
- Produces: `QuizMode=QuizType|'all'`, `QuizSession`(`new QuizSession({mode,difficulty,count},rng?)`, `.current`, `.index`, `.finished`, `.questions`, `.answer(i):boolean`(처음 답만 인정), `.next()`, `.result():{score,total,byType}`), `KeyValueStore`, `bestKey({mode,difficulty})`, `loadBest(store,key)`, `saveBest(store,key,score):boolean`.

**주의할 점 (시제품에서 확인함):**
- `erasableSyntaxOnly` 때문에 생성자 매개변수 속성(`constructor(readonly x)`)을 쓰지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/quiz/session.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/quiz/rng.ts';
import { bestKey, loadBest, QuizSession, saveBest } from '../../src/quiz/session.ts';

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('QuizSession', () => {
  it('정답 수와 유형별 통계를 센다', () => {
    const s = new QuizSession({ mode: 'all', difficulty: 'basic', count: 10 }, mulberry32(1));
    let i = 0;
    while (!s.finished) {
      const right = s.current.answerIndex;
      s.answer(i % 2 === 0 ? right : (right + 1) % 4);
      s.next();
      i++;
    }
    const r = s.result();
    expect(r.total).toBe(10);
    expect(r.score).toBe(5);
    expect(r.byType.A.total + r.byType.B.total + r.byType.C.total).toBe(10);
  });

  it('처음 고른 답만 인정한다', () => {
    const s = new QuizSession({ mode: 'A', difficulty: 'basic', count: 1 }, mulberry32(3));
    const wrong = (s.current.answerIndex + 1) % 4;
    expect(s.answer(wrong)).toBe(false);
    expect(s.answer(s.current.answerIndex)).toBe(false);
  });

  it('mode가 A면 모든 문제가 유형 A', () => {
    const s = new QuizSession({ mode: 'A', difficulty: 'advanced', count: 5 }, mulberry32(9));
    expect(s.questions.every((q) => q.type === 'A')).toBe(true);
  });
});

describe('최고 기록', () => {
  it('더 높은 점수만 저장한다', () => {
    const store = memoryStore();
    const key = bestKey({ mode: 'all', difficulty: 'basic' });
    expect(loadBest(store, key)).toBeNull();
    expect(saveBest(store, key, 5)).toBe(true);
    expect(saveBest(store, key, 3)).toBe(false);
    expect(saveBest(store, key, 7)).toBe(true);
    expect(loadBest(store, key)).toBe(7);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run tests/quiz/session.test.ts
```
예상: FAIL (아직 없는 모듈을 import하므로 "Failed to resolve import" 또는 "Cannot find module").

- [ ] **Step 3: `src/quiz/session.ts` 작성**

```ts
import type { Difficulty } from './figures.ts';
import { generateQuestion } from './generator.ts';
import { pick, type Rng } from './rng.ts';
import type { Question, QuizType } from './types.ts';

export type QuizMode = QuizType | 'all';

export interface SessionConfig {
  mode: QuizMode;
  difficulty: Difficulty;
  count: number;
}

export interface TypeStat {
  correct: number;
  total: number;
}

export interface SessionResult {
  score: number;
  total: number;
  byType: Record<QuizType, TypeStat>;
}

export class QuizSession {
  readonly config: SessionConfig;
  readonly questions: Question[];
  private answers: (number | null)[];
  private cursor = 0;

  constructor(config: SessionConfig, rng: Rng = Math.random) {
    this.config = config;
    const types: QuizType[] = ['A', 'B', 'C'];
    this.questions = Array.from({ length: config.count }, () =>
      generateQuestion(config.mode === 'all' ? pick(rng, types) : config.mode, config.difficulty, rng),
    );
    this.answers = this.questions.map(() => null);
  }

  get index(): number {
    return this.cursor;
  }

  get current(): Question {
    return this.questions[this.cursor];
  }

  get finished(): boolean {
    return this.cursor >= this.questions.length;
  }

  /** 현재 문제에 답한다. 이미 답했으면 처음 답을 유지한다. */
  answer(choiceIndex: number): boolean {
    if (this.answers[this.cursor] === null) this.answers[this.cursor] = choiceIndex;
    return this.answers[this.cursor] === this.current.answerIndex;
  }

  next(): void {
    this.cursor++;
  }

  result(): SessionResult {
    const byType: Record<QuizType, TypeStat> = {
      A: { correct: 0, total: 0 },
      B: { correct: 0, total: 0 },
      C: { correct: 0, total: 0 },
    };
    let score = 0;
    this.questions.forEach((q, i) => {
      const ok = this.answers[i] === q.answerIndex;
      byType[q.type].total++;
      if (ok) {
        byType[q.type].correct++;
        score++;
      }
    });
    return { score, total: this.questions.length, byType };
  }
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREFIX = 'revolution.best.';

export function bestKey(config: Pick<SessionConfig, 'mode' | 'difficulty'>): string {
  return `${PREFIX}${config.mode}-${config.difficulty}`;
}

export function loadBest(store: KeyValueStore, key: string): number | null {
  const raw = store.getItem(key);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 최고 기록이면 저장하고 true. */
export function saveBest(store: KeyValueStore, key: string, score: number): boolean {
  const prev = loadBest(store, key);
  if (prev !== null && prev >= score) return false;
  store.setItem(key, String(score));
  return true;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run tests/quiz/session.test.ts && npm run typecheck
```
예상: 모든 테스트 PASS, 타입 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add src/quiz/session.ts tests/quiz/session.test.ts
git commit -m "feat: 문제 세트 진행과 최고 기록"
```

---

### Task 7: 3D·2D 렌더링

**Files:**
- Create: `src/render/solid.ts`
- Create: `src/render/viewer.ts`
- Create: `src/render/thumbnail.ts`
- Create: `src/render/draw2d.ts`

**Interfaces:**
- Consumes: `bbox`, `ringsToMulti`, `axialSection`, `perpendicularSection`, `annuliToShape`, `halfProfile`, `figureInAxisFrame`.
- Produces (solid.ts): `COLORS`, `Bounds3={radius,minH,maxH}`, `profileBounds`, `mergeBounds`, `buildSolidGeometry(profile,thetaMax?,segments?)`, `shapesFromMulti`, `shapesFromRings`, `buildSolidGroup(profile,{angleDeg,figureRings?,cut?:{cut,angleDeg,clip}})`, `disposeGroup`, `fitCamera(camera,bounds,centerH)`, `addLights(scene,camera)`.
- Produces (viewer.ts): `ViewCut={cut,angleDeg}`, `SolidViewer`(`new SolidViewer(container)`, `.setFigure(figure|null)`, `.setAngle(deg)`, `.setCut(ViewCut|null)`, `.currentProfile`, `.dispose()`).
- Produces (thumbnail.ts): `solidImage(profile,{fitBounds?,cut?,size?}):string`(data URL), `prismImage(figure,size?)`.
- Produces (draw2d.ts): `COLORS_2D`, `View`, `toScreen`, `toWorld`, `drawGrid`, `drawRings`, `drawAxis`, `figureExtent`, `sectionExtent`, `paintFigure(canvas,figure,units)`, `paintSection(canvas,shape,units)`, `figureImage`, `sectionImage`.

**주의할 점 (시제품에서 확인함):**
- 점 [r,h]는 각도 φ에서 (r cos φ, h, −r sin φ)로 간다. `rotation.y = φ`와 같은 방향이라 평면 도형 메시를 그대로 돌려 쓸 수 있다.
- 단면 보기(clip)에서는 카메라 쪽 절반을 잘라내야 잘린 면이 보인다. 축 포함 평면의 법선은 −(sin a, 0, cos a).
- clip 상태에서는 반투명 자르는 평면을 그리지 않는다(단면 메시와 같은 위치라 무늬가 생김).
- 썸네일은 WebGL 렌더러 하나를 돌려 쓴다(태블릿 WebGL 컨텍스트 개수 제한).

- [ ] **Step 1: `src/render/solid.ts` 작성**

```ts
import * as THREE from 'three';
import { bbox } from '../geometry/polygon.ts';
import { annuliToShape, axialSection, perpendicularSection } from '../geometry/sections.ts';
import type { Cut, HalfProfile, MultiPolygon, Ring } from '../geometry/types.ts';

export const COLORS = {
  solid: 0x4f8ef7,
  figure: 0xff8a3d,
  section: 0xf59e0b,
  axis: 0xe5484d,
  plane: 0x7c5cff,
};

/** 회전체 크기 정보. 여러 그림을 같은 축척으로 맞출 때 쓴다. */
export interface Bounds3 {
  radius: number;
  minH: number;
  maxH: number;
}

export function profileBounds(profile: HalfProfile): Bounds3 {
  const b = bbox(profile);
  return { radius: b.maxX, minH: b.minY, maxH: b.maxY };
}

export function mergeBounds(list: Bounds3[]): Bounds3 {
  return {
    radius: Math.max(...list.map((b) => b.radius)),
    minH: Math.min(...list.map((b) => b.minH)),
    maxH: Math.max(...list.map((b) => b.maxH)),
  };
}

/**
 * 반쪽 단면 경계의 각 변을 Y축 둘레로 thetaMax(라디안)만큼 돌린 겉면.
 * 점 [r, h]는 각도 φ에서 (r cos φ, h, −r sin φ)로 간다(= rotation.y = φ 와 같은 방향).
 */
export function buildSolidGeometry(profile: HalfProfile, thetaMax = Math.PI * 2, segments = 64): THREE.BufferGeometry {
  const steps = Math.max(1, Math.ceil((segments * thetaMax) / (Math.PI * 2)));
  const positions: number[] = [];
  const indices: number[] = [];
  for (const poly of profile) for (const ring of poly) {
    for (let i = 0; i < ring.length; i++) {
      const [ra, ha] = ring[i];
      const [rb, hb] = ring[(i + 1) % ring.length];
      if (ra < 1e-9 && rb < 1e-9) continue; // 축 위의 변은 면을 만들지 않는다
      const base = positions.length / 3;
      for (let j = 0; j <= steps; j++) {
        const phi = (thetaMax * j) / steps;
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        positions.push(ra * c, ha, -ra * s, rb * c, hb, -rb * s);
      }
      for (let j = 0; j < steps; j++) {
        const i0 = base + 2 * j;
        indices.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function shapesFromMulti(mp: MultiPolygon): THREE.Shape[] {
  return mp.map(([outer, ...holes]) => {
    const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes = holes.map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    return shape;
  });
}

export function shapesFromRings(rings: Ring[]): THREE.Shape[] {
  return shapesFromMulti(rings.map((r) => [r]));
}

export interface SolidSceneOptions {
  /** 돌린 각도(도). 360이면 완성된 회전체. */
  angleDeg: number;
  /** 회전 중인 평면도형(축 좌표, r이 음수일 수 있음). angleDeg < 360일 때 표시. */
  figureRings?: Ring[];
  cut?: { cut: Cut; angleDeg: number; clip: boolean } | null;
}

/** 회전체 + 회전축 + (선택) 움직이는 도형 + (선택) 자르는 평면을 담은 그룹. */
export function buildSolidGroup(profile: HalfProfile, opts: SolidSceneOptions): THREE.Group {
  const group = new THREE.Group();
  const bounds = profileBounds(profile);
  const size = Math.max(bounds.radius * 2, bounds.maxH - bounds.minH, 1);
  const theta = (Math.min(360, Math.max(0, opts.angleDeg)) / 180) * Math.PI;

  const clippingPlanes: THREE.Plane[] = [];
  const cut = opts.cut ?? null;
  if (cut && cut.clip) {
    if (cut.cut.kind === 'axial') {
      const a = (cut.angleDeg / 180) * Math.PI;
      // 카메라 쪽(+z) 절반을 잘라내 잘린 면이 보이게 한다
      clippingPlanes.push(new THREE.Plane(new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)), 0));
    } else {
      clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), cut.cut.h));
    }
  }

  if (theta > 0) {
    const solid = new THREE.Mesh(
      buildSolidGeometry(profile, theta),
      new THREE.MeshStandardMaterial({
        color: COLORS.solid,
        roughness: 0.45,
        metalness: 0.05,
        side: THREE.DoubleSide,
        clippingPlanes,
      }),
    );
    group.add(solid);
  }

  if (opts.figureRings && opts.angleDeg < 360) {
    const fig = new THREE.Mesh(
      new THREE.ShapeGeometry(shapesFromRings(opts.figureRings)),
      new THREE.MeshBasicMaterial({ color: COLORS.figure, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    fig.rotation.y = theta;
    group.add(fig);
  }

  const axisLen = bounds.maxH - bounds.minH + size * 0.6;
  const axis = new THREE.Mesh(
    new THREE.CylinderGeometry(size * 0.008, size * 0.008, axisLen, 8),
    new THREE.MeshBasicMaterial({ color: COLORS.axis }),
  );
  axis.position.y = (bounds.minH + bounds.maxH) / 2;
  group.add(axis);

  if (cut && !cut.clip) {
    const planeMat = new THREE.MeshBasicMaterial({
      color: COLORS.plane,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const midH = (bounds.minH + bounds.maxH) / 2;
    if (cut.cut.kind === 'axial') {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, axisLen), planeMat);
      plane.position.y = midH;
      plane.rotation.y = (cut.angleDeg / 180) * Math.PI;
      group.add(plane);
    } else {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, size * 1.5), planeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = cut.cut.h;
      group.add(plane);
    }
  }
  if (cut && cut.clip) {
    const sectionMat = new THREE.MeshBasicMaterial({ color: COLORS.section, side: THREE.DoubleSide });
    if (cut.cut.kind === 'axial') {
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesFromMulti(axialSection(profile))), sectionMat);
      mesh.rotation.y = (cut.angleDeg / 180) * Math.PI;
      group.add(mesh);
    } else {
      const shape = annuliToShape(perpendicularSection(profile, cut.cut.h));
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesFromMulti(shape)), sectionMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = cut.cut.h;
      group.add(mesh);
    }
  }
  return group;
}

/** 그룹 안의 지오메트리·재질을 모두 해제한다. */
export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m: THREE.Material) => m.dispose());
    }
  });
}

/** bounds 크기에 맞춰 카메라를 비스듬한 위에서 바라보게 둔다. center는 바라볼 높이. */
export function fitCamera(camera: THREE.PerspectiveCamera, bounds: Bounds3, centerH: number): THREE.Vector3 {
  // 회전체를 감싸는 구가 화면 세로에 여유 있게 들어가도록 거리를 정한다
  const sphere = Math.max(Math.hypot(bounds.radius, (bounds.maxH - bounds.minH) / 2), 0.5);
  const dist = (sphere / Math.sin(((camera.fov / 2) * Math.PI) / 180)) * 1.35;
  const dir = new THREE.Vector3(1, 0.75, 1.4).normalize();
  const target = new THREE.Vector3(0, centerH, 0);
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.near = dist / 100;
  camera.far = dist * 10;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target;
}

export function addLights(scene: THREE.Scene, camera: THREE.Camera): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 2, 3);
  camera.add(key);
  scene.add(camera);
}
```

- [ ] **Step 2: `src/render/viewer.ts` 작성**

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { figureInAxisFrame, halfProfile } from '../geometry/profile.ts';
import type { Cut, Figure, HalfProfile, Ring } from '../geometry/types.ts';
import { addLights, buildSolidGroup, disposeGroup, fitCamera, profileBounds } from './solid.ts';

export interface ViewCut {
  cut: Cut;
  /** 축을 포함하는 평면의 방향(도). perpendicular일 때는 무시. */
  angleDeg: number;
}

/** 탐구 모드·해설에서 쓰는 손으로 돌려 볼 수 있는 3D 보기. */
export class SolidViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
  private controls: OrbitControls;
  private group: THREE.Group | null = null;
  private resizeObserver: ResizeObserver;
  private frame = 0;

  private profile: HalfProfile = [];
  private figureRings: Ring[] = [];
  private angleDeg = 360;
  private cut: ViewCut | null = null;

  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.setClearColor(0xf3f5fb);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    addLights(this.scene, this.camera);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', () => this.requestRender());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  get currentProfile(): HalfProfile {
    return this.profile;
  }

  setFigure(figure: Figure | null): void {
    this.profile = figure ? halfProfile(figure) : [];
    this.figureRings = figure ? figureInAxisFrame(figure) : [];
    if (this.profile.length > 0) {
      const b = profileBounds(this.profile);
      const target = fitCamera(this.camera, b, (b.minH + b.maxH) / 2);
      this.controls.target.copy(target);
      this.controls.update();
    }
    this.rebuild();
  }

  setAngle(deg: number): void {
    this.angleDeg = deg;
    this.rebuild();
  }

  setCut(cut: ViewCut | null): void {
    this.cut = cut;
    this.rebuild();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    if (this.group) disposeGroup(this.group);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private rebuild(): void {
    if (this.group) {
      this.scene.remove(this.group);
      disposeGroup(this.group);
      this.group = null;
    }
    if (this.profile.length > 0) {
      this.group = buildSolidGroup(this.profile, {
        angleDeg: this.angleDeg,
        figureRings: this.figureRings,
        cut: this.cut ? { ...this.cut, clip: true } : null,
      });
      this.scene.add(this.group);
    }
    this.requestRender();
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }
}
```

- [ ] **Step 3: `src/render/thumbnail.ts` 작성**

```ts
import * as THREE from 'three';
import { bbox, ringsToMulti } from '../geometry/polygon.ts';
import type { Cut, Figure, HalfProfile } from '../geometry/types.ts';
import {
  addLights,
  type Bounds3,
  buildSolidGroup,
  COLORS,
  disposeGroup,
  fitCamera,
  profileBounds,
  shapesFromRings,
} from './solid.ts';

/** 보기 썸네일은 WebGL 렌더러 하나를 돌려 쓴다(태블릿의 WebGL 컨텍스트 개수 제한 대비). */
let shared: { renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } | null = null;

function getShared(size: number) {
  if (!shared) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.localClippingEnabled = true;
    renderer.setClearColor(0xf3f5fb);
    shared = { renderer, camera: new THREE.PerspectiveCamera(35, 1, 0.1, 1000) };
  }
  shared.renderer.setPixelRatio(1);
  shared.renderer.setSize(size, size, false);
  return shared;
}

function snapshot(object: THREE.Object3D, bounds: Bounds3, centerH: number, size: number): string {
  const { renderer, camera } = getShared(size);
  const scene = new THREE.Scene();
  addLights(scene, camera);
  scene.add(object);
  fitCamera(camera, bounds, centerH);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL();
  camera.clear();
  disposeGroup(object);
  return url;
}

export interface SolidImageOptions {
  /** 여러 보기의 축척을 맞추기 위한 공통 크기. 없으면 자기 크기에 맞춘다. */
  fitBounds?: Bounds3;
  /** 자르는 평면을 보여줄 때(자르지는 않음) */
  cut?: Cut;
  size?: number;
}

export function solidImage(profile: HalfProfile, opts: SolidImageOptions = {}): string {
  const own = profileBounds(profile);
  const group = buildSolidGroup(profile, {
    angleDeg: 360,
    cut: opts.cut ? { cut: opts.cut, angleDeg: 35, clip: false } : null,
  });
  return snapshot(group, opts.fitBounds ?? own, (own.minH + own.maxH) / 2, opts.size ?? 240);
}

/** '돌리지 않고 밀어낸' 각기둥 그림(오답 보기용). */
export function prismImage(figure: Figure, size = 240): string {
  const b = bbox(ringsToMulti(figure.pieces));
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const depth = Math.max(w, h) * 0.8;
  const geo = new THREE.ExtrudeGeometry(shapesFromRings(figure.pieces), { depth, bevelEnabled: false });
  geo.translate(-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2, -depth / 2);
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.solid, roughness: 0.45, metalness: 0.05 })),
  );
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x1e3a8a })));
  const r = Math.max(w, depth) / 2;
  return snapshot(group, { radius: r, minH: -h / 2, maxH: h / 2 }, 0, size);
}
```

- [ ] **Step 4: `src/render/draw2d.ts` 작성**

```ts
import { bbox, ringsToMulti } from '../geometry/polygon.ts';
import type { Figure, MultiPolygon, Ring } from '../geometry/types.ts';

export const COLORS_2D = {
  bg: '#ffffff',
  grid: '#e3e7f0',
  gridStrong: '#c5ccdb',
  figureFill: 'rgba(255, 138, 61, 0.45)',
  figureStroke: '#e8681a',
  sectionFill: 'rgba(245, 158, 11, 0.75)',
  sectionStroke: '#b45309',
  axis: '#e5484d',
};

/** 화면 좌표 변환: 세계 좌표 중심(cx, cy)을 캔버스 가운데에 두고 1단위 = scale px. y는 위로. */
export interface View {
  cx: number;
  cy: number;
  scale: number;
  width: number;
  height: number;
}

export function toScreen(v: View, x: number, y: number): [number, number] {
  return [v.width / 2 + (x - v.cx) * v.scale, v.height / 2 - (y - v.cy) * v.scale];
}

export function toWorld(v: View, px: number, py: number): [number, number] {
  return [v.cx + (px - v.width / 2) / v.scale, v.cy - (py - v.height / 2) / v.scale];
}

export function drawGrid(ctx: CanvasRenderingContext2D, v: View): void {
  ctx.fillStyle = COLORS_2D.bg;
  ctx.fillRect(0, 0, v.width, v.height);
  const [x0, y1] = toWorld(v, 0, 0);
  const [x1, y0] = toWorld(v, v.width, v.height);
  ctx.lineWidth = 1;
  for (let x = Math.ceil(x0); x <= x1; x++) {
    ctx.strokeStyle = x === 0 ? COLORS_2D.gridStrong : COLORS_2D.grid;
    const [px] = toScreen(v, x, 0);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, v.height);
    ctx.stroke();
  }
  for (let y = Math.ceil(y0); y <= y1; y++) {
    ctx.strokeStyle = y === 0 ? COLORS_2D.gridStrong : COLORS_2D.grid;
    const [, py] = toScreen(v, 0, y);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(v.width, py);
    ctx.stroke();
  }
}

function tracePath(ctx: CanvasRenderingContext2D, v: View, rings: Ring[]): void {
  ctx.beginPath();
  for (const ring of rings) {
    ring.forEach(([x, y], i) => {
      const [px, py] = toScreen(v, x, y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }
}

export function drawRings(ctx: CanvasRenderingContext2D, v: View, rings: Ring[], fill: string, stroke: string): void {
  tracePath(ctx, v, rings);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function drawAxis(ctx: CanvasRenderingContext2D, v: View, figure: Figure): void {
  ctx.save();
  ctx.strokeStyle = COLORS_2D.axis;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 4, 2, 4]);
  ctx.beginPath();
  if (figure.axis.dir === 'vertical') {
    const [px] = toScreen(v, figure.axis.pos, 0);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, v.height);
  } else {
    const [, py] = toScreen(v, 0, figure.axis.pos);
    ctx.moveTo(0, py);
    ctx.lineTo(v.width, py);
  }
  ctx.stroke();
  ctx.restore();
}

/** 도형 + 축 범위를 담는 세계 좌표 크기(가로·세로 중 큰 값). 보기들의 축척을 맞출 때 쓴다. */
export function figureExtent(figure: Figure): number {
  const b = bbox(ringsToMulti(figure.pieces));
  const minX = figure.axis.dir === 'vertical' ? Math.min(b.minX, figure.axis.pos) : b.minX;
  const maxX = figure.axis.dir === 'vertical' ? Math.max(b.maxX, figure.axis.pos) : b.maxX;
  const minY = figure.axis.dir === 'horizontal' ? Math.min(b.minY, figure.axis.pos) : b.minY;
  const maxY = figure.axis.dir === 'horizontal' ? Math.max(b.maxY, figure.axis.pos) : b.maxY;
  return Math.max(maxX - minX, maxY - minY);
}

export function sectionExtent(shape: MultiPolygon): number {
  const b = bbox(shape);
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

/** 도형+축 그림을 캔버스에 그린다. unitsAcross: 캔버스 짧은 변에 들어갈 세계 단위 수. */
export function paintFigure(canvas: HTMLCanvasElement, figure: Figure, unitsAcross: number): void {
  const ctx = canvas.getContext('2d')!;
  const b = bbox(ringsToMulti(figure.pieces));
  const ax = figure.axis;
  const minX = ax.dir === 'vertical' ? Math.min(b.minX, ax.pos) : b.minX;
  const maxX = ax.dir === 'vertical' ? Math.max(b.maxX, ax.pos) : b.maxX;
  const minY = ax.dir === 'horizontal' ? Math.min(b.minY, ax.pos) : b.minY;
  const maxY = ax.dir === 'horizontal' ? Math.max(b.maxY, ax.pos) : b.maxY;
  const v: View = {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    scale: Math.min(canvas.width, canvas.height) / unitsAcross,
    width: canvas.width,
    height: canvas.height,
  };
  drawGrid(ctx, v);
  drawRings(ctx, v, figure.pieces, COLORS_2D.figureFill, COLORS_2D.figureStroke);
  drawAxis(ctx, v, figure);
}

/** 단면 그림을 가운데에 그린다. */
export function paintSection(canvas: HTMLCanvasElement, shape: MultiPolygon, unitsAcross: number): void {
  const ctx = canvas.getContext('2d')!;
  const b = bbox(shape);
  const v: View = {
    cx: (b.minX + b.maxX) / 2,
    cy: (b.minY + b.maxY) / 2,
    scale: Math.min(canvas.width, canvas.height) / unitsAcross,
    width: canvas.width,
    height: canvas.height,
  };
  drawGrid(ctx, v);
  drawRings(ctx, v, shape.flat(), COLORS_2D.sectionFill, COLORS_2D.sectionStroke);
}

function offscreen(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

export function figureImage(figure: Figure, unitsAcross: number, size = 240): string {
  const c = offscreen(size);
  paintFigure(c, figure, unitsAcross);
  return c.toDataURL();
}

export function sectionImage(shape: MultiPolygon, unitsAcross: number, size = 240): string {
  const c = offscreen(size);
  paintSection(c, shape, unitsAcross);
  return c.toDataURL();
}
```

- [ ] **Step 5: 확인**

이 작업은 단위 테스트 대신 `npm run typecheck`로 확인하고, 화면 확인은 Task 10에서 한다.

- [ ] **Step 6: 커밋**

```bash
git add src/render/solid.ts src/render/viewer.ts src/render/thumbnail.ts src/render/draw2d.ts
git commit -m "feat: 3D 회전체·단면 렌더링과 2D 그림"
```

---

### Task 8: 모눈 작업판(프리셋·직접 그리기·축 끌기)

**Files:**
- Create: `src/editor/gridEditor.ts`

**Interfaces:**
- Consumes: `halfProfile`, `fromAxisPoint`, `validateRing`, `drawGrid`, `drawRings`, `toScreen`, `toWorld`.
- Produces: `EDITOR_MESSAGES`, `GridEditor`(`new GridEditor(canvas,{onChange(figure|null),onMessage(text)})`, `.setFigure(figure|null,editable)`, `.startDrawing()`, `.clear()`, `.setAxisDir(dir)`, `.currentAxis`, `.dispose()`).

**주의할 점 (시제품에서 확인함):**
- 세계 좌표 범위 x −7~7, y −1~9. 모든 점은 정수 격자에 붙는다.
- 꼭짓점을 끌다가 자기 교차가 되면 손을 뗄 때 원래 모양으로 되돌리고 안내 문구를 띄운다.
- 접힌 반쪽 단면을 보라색으로 옅게 겹쳐 그려, 축이 도형을 가로지를 때 어느 부분이 회전체를 결정하는지 보여준다.

- [ ] **Step 1: `src/editor/gridEditor.ts` 작성**

```ts
import { fromAxisPoint, halfProfile } from '../geometry/profile.ts';
import type { Axis, AxisDir, Figure, Ring, Vec2 } from '../geometry/types.ts';
import { validateRing } from '../geometry/validate.ts';
import { COLORS_2D, drawGrid, drawRings, toScreen, toWorld, type View } from '../render/draw2d.ts';

/** 모눈 작업판이 보여주는 세계 좌표 범위 */
const WORLD = { minX: -7, maxX: 7, minY: -1, maxY: 9 };
const VERTEX_HIT_PX = 24;
const AXIS_HIT_PX = 18;

export const EDITOR_MESSAGES = {
  'too-few': '점을 3개 이상 찍어야 도형이 돼요.',
  'zero-area': '넓이가 없는 도형은 돌릴 수 없어요.',
  'self-intersect': '변끼리 겹치지 않게 그려 주세요.',
  drawHint: '모눈의 점을 차례로 눌러 도형을 그리고, 첫 점을 다시 누르면 완성돼요.',
} as const;

export interface GridEditorCallbacks {
  onChange(figure: Figure | null): void;
  onMessage(message: string): void;
}

type Drag = { kind: 'axis' } | { kind: 'vertex'; piece: number; index: number; original: Ring } | null;

export class GridEditor {
  private ctx: CanvasRenderingContext2D;
  private view: View = { cx: 0, cy: 4, scale: 40, width: 0, height: 0 };
  private dpr = 1;
  private figure: Figure | null = null;
  private axis: Axis = { dir: 'vertical', pos: 0 };
  private editable = false;
  private drawing: Vec2[] | null = null;
  private drag: Drag = null;
  private resizeObserver: ResizeObserver;
  private canvas: HTMLCanvasElement;
  private callbacks: GridEditorCallbacks;

  constructor(canvas: HTMLCanvasElement, callbacks: GridEditorCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.ctx = canvas.getContext('2d')!;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  get currentAxis(): Axis {
    return this.axis;
  }

  setFigure(figure: Figure | null, editable: boolean): void {
    this.figure = figure ? { pieces: figure.pieces.map((r) => r.map((p) => [...p] as Vec2)), axis: figure.axis } : null;
    if (figure) this.axis = { ...figure.axis };
    this.editable = editable;
    this.drawing = null;
    this.redraw();
    this.emit();
  }

  startDrawing(): void {
    this.figure = null;
    this.drawing = [];
    this.editable = true;
    this.callbacks.onMessage(EDITOR_MESSAGES.drawHint);
    this.redraw();
    this.emit();
  }

  clear(): void {
    this.figure = null;
    this.drawing = null;
    this.redraw();
    this.emit();
  }

  setAxisDir(dir: AxisDir): void {
    this.axis = { dir, pos: 0 };
    if (this.figure) this.figure = { ...this.figure, axis: this.axis };
    this.redraw();
    this.emit();
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  private emit(): void {
    this.callbacks.onChange(this.figure ? { pieces: this.figure.pieces, axis: this.axis } : null);
  }

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const scale = Math.min(w / (WORLD.maxX - WORLD.minX), h / (WORLD.maxY - WORLD.minY));
    this.view = {
      cx: (WORLD.minX + WORLD.maxX) / 2,
      cy: (WORLD.minY + WORLD.maxY) / 2,
      scale,
      width: w,
      height: h,
    };
    this.redraw();
  }

  private pointerWorld(e: PointerEvent): { world: Vec2; snapped: Vec2; px: Vec2 } {
    const rect = this.canvas.getBoundingClientRect();
    const px: Vec2 = [e.clientX - rect.left, e.clientY - rect.top];
    const world = toWorld(this.view, px[0], px[1]) as Vec2;
    const snapped: Vec2 = [
      Math.min(WORLD.maxX, Math.max(WORLD.minX, Math.round(world[0]))),
      Math.min(WORLD.maxY, Math.max(WORLD.minY, Math.round(world[1]))),
    ];
    return { world, snapped, px };
  }

  private axisDistancePx(px: Vec2): number {
    const [ax, ay] = toScreen(this.view, this.axis.pos, this.axis.pos);
    return this.axis.dir === 'vertical' ? Math.abs(px[0] - ax) : Math.abs(px[1] - ay);
  }

  private hitVertex(px: Vec2): { piece: number; index: number } | null {
    if (!this.figure || !this.editable) return null;
    for (let p = 0; p < this.figure.pieces.length; p++) {
      const ring = this.figure.pieces[p];
      for (let i = 0; i < ring.length; i++) {
        const [sx, sy] = toScreen(this.view, ring[i][0], ring[i][1]);
        if (Math.hypot(sx - px[0], sy - px[1]) < VERTEX_HIT_PX) return { piece: p, index: i };
      }
    }
    return null;
  }

  private onDown = (e: PointerEvent): void => {
    const { snapped, px } = this.pointerWorld(e);
    if (this.drawing) {
      this.addDrawingPoint(snapped);
      return;
    }
    const v = this.hitVertex(px);
    if (v && this.figure) {
      this.drag = { kind: 'vertex', ...v, original: this.figure.pieces[v.piece].map((q) => [...q] as Vec2) };
    } else if (this.axisDistancePx(px) < AXIS_HIT_PX) {
      this.drag = { kind: 'axis' };
    } else {
      return;
    }
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    const { snapped } = this.pointerWorld(e);
    if (this.drag.kind === 'axis') {
      const pos = this.axis.dir === 'vertical' ? snapped[0] : snapped[1];
      if (pos === this.axis.pos) return;
      this.axis = { ...this.axis, pos };
      if (this.figure) this.figure = { ...this.figure, axis: this.axis };
      this.redraw();
      this.emit();
    } else if (this.figure) {
      const ring = this.figure.pieces[this.drag.piece];
      const cur = ring[this.drag.index];
      if (cur[0] === snapped[0] && cur[1] === snapped[1]) return;
      ring[this.drag.index] = snapped;
      this.redraw();
      if (validateRing(ring) === 'ok') this.emit();
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.drag) return;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (this.drag.kind === 'vertex' && this.figure) {
      const problem = validateRing(this.figure.pieces[this.drag.piece]);
      if (problem !== 'ok') {
        this.figure.pieces[this.drag.piece] = this.drag.original;
        this.callbacks.onMessage(EDITOR_MESSAGES[problem]);
        this.redraw();
        this.emit();
      }
    }
    this.drag = null;
  };

  private addDrawingPoint(p: Vec2): void {
    const pts = this.drawing!;
    const last = pts[pts.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    const first = pts[0];
    if (first && pts.length >= 3 && first[0] === p[0] && first[1] === p[1]) {
      const problem = validateRing(pts);
      if (problem !== 'ok') {
        this.callbacks.onMessage(EDITOR_MESSAGES[problem]);
        return;
      }
      this.figure = { pieces: [pts], axis: this.axis };
      this.drawing = null;
      this.callbacks.onMessage('');
      this.redraw();
      this.emit();
      return;
    }
    pts.push(p);
    this.redraw();
  }

  private redraw(): void {
    const { ctx, view } = this;
    if (view.width === 0) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawGrid(ctx, view);

    if (this.figure) {
      // 접힌 반쪽 단면(실제로 회전체를 결정하는 부분)을 옅게 먼저 그린다
      const half = halfProfile({ pieces: this.figure.pieces, axis: this.axis });
      const halfRings = half.flat().map((ring) => ring.map((q) => fromAxisPoint(q, this.axis)));
      drawRings(ctx, view, halfRings, 'rgba(124, 92, 255, 0.18)', 'rgba(124, 92, 255, 0.5)');
      drawRings(ctx, view, this.figure.pieces, COLORS_2D.figureFill, COLORS_2D.figureStroke);
      if (this.editable) {
        ctx.fillStyle = COLORS_2D.figureStroke;
        for (const ring of this.figure.pieces) for (const [x, y] of ring) {
          const [sx, sy] = toScreen(view, x, y);
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (this.drawing) {
      ctx.strokeStyle = COLORS_2D.figureStroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.drawing.forEach(([x, y], i) => {
        const [sx, sy] = toScreen(view, x, y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      this.drawing.forEach(([x, y], i) => {
        const [sx, sy] = toScreen(view, x, y);
        ctx.fillStyle = i === 0 ? '#16a34a' : COLORS_2D.figureStroke;
        ctx.beginPath();
        ctx.arc(sx, sy, i === 0 ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 회전축 + 끌기 손잡이
    ctx.save();
    ctx.strokeStyle = COLORS_2D.axis;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 5, 3, 5]);
    ctx.beginPath();
    let handle: [number, number];
    if (this.axis.dir === 'vertical') {
      const [sx] = toScreen(view, this.axis.pos, 0);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, view.height);
      handle = [sx, 18];
    } else {
      const [, sy] = toScreen(view, 0, this.axis.pos);
      ctx.moveTo(0, sy);
      ctx.lineTo(view.width, sy);
      handle = [view.width - 18, sy];
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS_2D.axis;
    ctx.beginPath();
    ctx.arc(handle[0], handle[1], 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('축', handle[0], handle[1]);
    ctx.restore();
  }
}
```

- [ ] **Step 2: 확인**

`npm run typecheck`로 확인. 화면 확인은 Task 10.

- [ ] **Step 3: 커밋**

```bash
git add src/editor/gridEditor.ts
git commit -m "feat: 모눈 작업판"
```

---

### Task 9: 화면(홈·탐구·문제)과 앱 진입점

**Files:**
- Create: `src/ui/dom.ts`
- Create: `src/ui/router.ts`
- Create: `src/ui/home.ts`
- Create: `src/ui/explore.ts`
- Create: `src/ui/visuals.ts`
- Create: `src/ui/quiz.ts`
- Create: `src/style.css`
- Create: `src/main.ts`

**Interfaces:**
- Consumes: Task 2~8의 공개 함수 전부.
- Produces: `h(tag.class, props, ...children)`, `segmented(options,initial,onSelect)`, `ScreenName`, `Screen`, `startRouter(root,screens)`, `homeScreen`, `exploreScreen`, `quizScreen`, `questionScale(q)`, `visualImage(visual,scale,size?)`.

**주의할 점 (시제품에서 확인함):**
- 주소 `#/explore`, `#/quiz`로 화면을 바꿔 안드로이드 뒤로 가기가 그대로 동작한다.
- 문제 한 개 안의 그림은 `questionScale`로 같은 축척을 쓴다(크기만 다른 오답을 구별할 수 있게).
- 가로 화면(900px 이상)에서는 문제 그림을 왼쪽, 보기 2×2를 오른쪽에 둔다.
- 답을 고른 뒤 보기 버튼은 disabled이지만 흐려지지 않게(`.choice:disabled{opacity:1}`) 해서 정답·오답 색이 보이게 한다.

- [ ] **Step 1: `src/ui/dom.ts` 작성**

```ts
/** 작은 DOM 도우미. h('button.primary', { onclick }, '텍스트') */
export function h<K extends keyof HTMLElementTagNameMap>(
  tagAndClass: K | `${K}.${string}`,
  props: Partial<Record<string, unknown>> = {},
  ...children: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = tagAndClass.split('.');
  const el = document.createElement(tag as K);
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === 'dataset') {
      Object.assign(el.dataset, v);
    } else if (k in el) {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) if (c !== null && c !== false) el.append(c);
  return el;
}

/** 버튼 묶음에서 하나만 선택 상태로 표시한다. */
export function segmented<T extends string>(
  options: { value: T; label: string }[],
  initial: T,
  onSelect: (value: T) => void,
): HTMLDivElement {
  const wrap = h('div.segmented');
  const buttons = options.map((o) =>
    h('button.seg', {
      type: 'button',
      onclick: () => {
        buttons.forEach((b) => b.classList.toggle('active', b === btn(o.value)));
        onSelect(o.value);
      },
      dataset: { value: o.value },
    }, o.label),
  );
  const btn = (v: T) => buttons.find((b) => b.dataset.value === v)!;
  btn(initial).classList.add('active');
  wrap.append(...buttons);
  return wrap;
}
```

- [ ] **Step 2: `src/ui/router.ts` 작성**

```ts
export type ScreenName = 'home' | 'explore' | 'quiz';

/** 화면을 root에 그리고, 화면을 떠날 때 부를 정리 함수를 돌려준다. */
export type Screen = (root: HTMLElement, go: (name: ScreenName) => void) => () => void;

function current(): ScreenName {
  const name = location.hash.replace('#/', '');
  return name === 'explore' || name === 'quiz' ? name : 'home';
}

/** 주소의 #/explore, #/quiz 에 따라 화면을 바꾼다. 안드로이드 뒤로 가기도 그대로 동작한다. */
export function startRouter(root: HTMLElement, screens: Record<ScreenName, Screen>): void {
  let cleanup: (() => void) | null = null;
  const go = (name: ScreenName) => {
    location.hash = name === 'home' ? '' : `#/${name}`;
  };
  const render = () => {
    cleanup?.();
    root.replaceChildren();
    cleanup = screens[current()](root, go);
  };
  window.addEventListener('hashchange', render);
  render();
}
```

- [ ] **Step 3: `src/ui/home.ts` 작성**

```ts
import { h } from './dom.ts';
import type { Screen } from './router.ts';

export const homeScreen: Screen = (root, go) => {
  root.append(
    h('main.home',
      {},
      h('div.home-badge', {}, '중1 도형 · 회전체'),
      h('h1.home-title', {}, '회전체 연습'),
      h('p.home-sub', {}, '평면도형을 회전축 둘레로 한 바퀴 돌리면 어떤 입체가 될까요?'),
      h('div.home-actions',
        {},
        h('button.big.primary', { type: 'button', onclick: () => go('explore') },
          h('span.big-icon', {}, '🔄'), h('span', {}, '탐구하기'), h('small', {}, '도형을 골라 직접 돌려 보기')),
        h('button.big.secondary', { type: 'button', onclick: () => go('quiz') },
          h('span.big-icon', {}, '✏️'), h('span', {}, '문제 풀기'), h('small', {}, '회전체·원래 도형·단면 맞히기')),
      ),
    ),
  );
  return () => {};
};
```

- [ ] **Step 4: `src/ui/explore.ts` 작성**

```ts
import { classify } from '../geometry/classify.ts';
import { halfProfile } from '../geometry/profile.ts';
import { annuliToShape, axialSection, perpendicularSection } from '../geometry/sections.ts';
import { PRESETS } from '../geometry/shapes.ts';
import type { AxisDir, HalfProfile } from '../geometry/types.ts';
import { GridEditor } from '../editor/gridEditor.ts';
import { paintSection } from '../render/draw2d.ts';
import { profileBounds } from '../render/solid.ts';
import { SolidViewer } from '../render/viewer.ts';
import { h, segmented } from './dom.ts';
import type { Screen } from './router.ts';

type SectionKind = 'none' | 'axial' | 'perpendicular';

const SWEEP_MS = 3000;

export const exploreScreen: Screen = (root, go) => {
  const message = h('p.message', {}, '');
  const gridCanvas = h('canvas.grid-canvas');
  const viewerBox = h('div.viewer');
  const nameTag = h('div.name-tag', {}, '도형을 고르거나 그려 보세요');
  const angleInput = h('input.slider', { type: 'range', min: '0', max: '360', step: '1', value: '360' });
  const angleLabel = h('span.slider-label', {}, '360°');
  const playBtn = h('button.play', { type: 'button' }, '▶ 돌리기');
  const cutInput = h('input.slider', { type: 'range', min: '0', max: '100', step: '1', value: '50' });
  const cutLabel = h('span.slider-label', {}, '');
  const cutRow = h('div.row.cut-row', { hidden: true }, h('span.row-label', {}, '자르는 위치'), cutInput, cutLabel);
  const miniCanvas = h('canvas.mini-section', { width: 220, height: 220, hidden: true });

  let profile: HalfProfile = [];
  let sectionKind: SectionKind = 'none';
  let animFrame = 0;

  const viewer = new SolidViewer(viewerBox);
  const editor = new GridEditor(gridCanvas, {
    onChange: (f) => {
      profile = f ? halfProfile(f) : [];
      viewer.setFigure(f);
      nameTag.textContent = profile.length ? `→ ${classify(profile).name}` : '도형을 고르거나 그려 보세요';
      updateSection();
    },
    onMessage: (m) => {
      message.textContent = m;
    },
  });

  function setAngle(deg: number) {
    angleInput.value = String(Math.round(deg));
    angleLabel.textContent = `${Math.round(deg)}°`;
    viewer.setAngle(deg);
  }

  function stopAnim() {
    cancelAnimationFrame(animFrame);
    animFrame = 0;
    playBtn.textContent = '▶ 돌리기';
  }

  function play() {
    if (animFrame) {
      stopAnim();
      return;
    }
    const startDeg = Number(angleInput.value) >= 360 ? 0 : Number(angleInput.value);
    const start = performance.now() - (startDeg / 360) * SWEEP_MS;
    playBtn.textContent = '⏸ 멈추기';
    const step = (now: number) => {
      const deg = Math.min(360, ((now - start) / SWEEP_MS) * 360);
      setAngle(deg);
      if (deg < 360) animFrame = requestAnimationFrame(step);
      else stopAnim();
    };
    animFrame = requestAnimationFrame(step);
  }

  function updateSection() {
    const active = sectionKind !== 'none' && profile.length > 0;
    cutRow.hidden = sectionKind === 'none';
    miniCanvas.hidden = !active;
    playBtn.disabled = sectionKind !== 'none';
    angleInput.disabled = sectionKind !== 'none';
    if (!active) {
      viewer.setCut(null);
      return;
    }
    stopAnim();
    setAngle(360);
    const t = Number(cutInput.value) / 100;
    const b = profileBounds(profile);
    const units = b.radius * 2 + 2;
    if (sectionKind === 'axial') {
      const angleDeg = t * 180;
      cutLabel.textContent = `${Math.round(angleDeg)}°`;
      viewer.setCut({ cut: { kind: 'axial' }, angleDeg });
      paintSection(miniCanvas, axialSection(profile), Math.max(units, b.maxH - b.minH + 2));
    } else {
      const tt = Math.min(0.98, Math.max(0.02, t));
      const hh = b.minH + tt * (b.maxH - b.minH);
      cutLabel.textContent = `높이 ${hh.toFixed(1)}`;
      viewer.setCut({ cut: { kind: 'perpendicular', h: hh }, angleDeg: 0 });
      const shape = annuliToShape(perpendicularSection(profile, hh));
      if (shape.length) paintSection(miniCanvas, shape, units);
      else miniCanvas.getContext('2d')!.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    }
  }

  angleInput.addEventListener('input', () => {
    stopAnim();
    setAngle(Number(angleInput.value));
  });
  cutInput.addEventListener('input', updateSection);
  playBtn.addEventListener('click', play);

  const presetButtons = PRESETS.map((p) =>
    h('button.chip', {
      type: 'button',
      onclick: () => {
        message.textContent = '';
        editor.setFigure(p.figure, p.editable);
      },
    }, p.label),
  );

  root.append(
    h('main.explore',
      {},
      h('header.topbar', {}, h('button.back', { type: 'button', onclick: () => go('home') }, '← 홈'), h('h2', {}, '탐구하기')),
      h('div.explore-body',
        {},
        h('section.panel.panel-2d',
          {},
          h('div.chips', {}, ...presetButtons),
          h('div.row',
            {},
            h('button.tool', { type: 'button', onclick: () => editor.startDrawing() }, '✏️ 직접 그리기'),
            h('button.tool', { type: 'button', onclick: () => { message.textContent = ''; editor.clear(); } }, '지우기'),
            h('span.row-label', {}, '회전축'),
            segmented<AxisDir>(
              [{ value: 'vertical', label: '세로' }, { value: 'horizontal', label: '가로' }],
              'vertical',
              (d) => editor.setAxisDir(d),
            ),
          ),
          h('div.grid-wrap', {}, gridCanvas),
          message,
        ),
        h('section.panel.panel-3d',
          {},
          h('div.viewer-wrap', {}, viewerBox, nameTag, miniCanvas),
          h('div.row', {}, playBtn, angleInput, angleLabel),
          h('div.row',
            {},
            h('span.row-label', {}, '단면'),
            segmented<SectionKind>(
              [
                { value: 'none', label: '없음' },
                { value: 'axial', label: '축을 포함' },
                { value: 'perpendicular', label: '축에 수직' },
              ],
              'none',
              (k) => {
                sectionKind = k;
                cutInput.value = '50';
                updateSection();
              },
            ),
          ),
          cutRow,
        ),
      ),
    ),
  );

  editor.setFigure(PRESETS[0].figure, PRESETS[0].editable);

  return () => {
    stopAnim();
    editor.dispose();
    viewer.dispose();
  };
};
```

- [ ] **Step 5: `src/ui/visuals.ts` 작성**

```ts
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
```

- [ ] **Step 6: `src/ui/quiz.ts` 작성**

```ts
import type { Difficulty } from '../quiz/figures.ts';
import { bestKey, loadBest, type QuizMode, QuizSession, saveBest } from '../quiz/session.ts';
import type { QuizType } from '../quiz/types.ts';
import { SolidViewer } from '../render/viewer.ts';
import { h, segmented } from './dom.ts';
import type { Screen } from './router.ts';
import { questionScale, visualImage } from './visuals.ts';

const QUESTION_COUNT = 10;
const TYPE_LABEL: Record<QuizType, string> = {
  A: '회전체 맞히기',
  B: '원래 도형 찾기',
  C: '단면 맞히기',
};
const MARKS = ['①', '②', '③', '④'];

function storage() {
  try {
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  }
}

export const quizScreen: Screen = (root, go) => {
  let mode: QuizMode = 'all';
  let difficulty: Difficulty = 'basic';
  let session: QuizSession | null = null;
  let explainViewer: SolidViewer | null = null;
  let timers: number[] = [];

  const body = h('div.quiz-body');
  root.append(
    h('main.quiz',
      {},
      h('header.topbar', {}, h('button.back', { type: 'button', onclick: () => go('home') }, '← 홈'), h('h2', {}, '문제 풀기')),
      body,
    ),
  );

  function clearExplain() {
    explainViewer?.dispose();
    explainViewer = null;
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function showSetup() {
    clearExplain();
    const best = loadBest(storage(), bestKey({ mode, difficulty }));
    const bestLine = h('p.best', {}, best === null ? '아직 기록이 없어요' : `최고 기록 ${best} / ${QUESTION_COUNT}`);
    const refreshBest = () => {
      const b = loadBest(storage(), bestKey({ mode, difficulty }));
      bestLine.textContent = b === null ? '아직 기록이 없어요' : `최고 기록 ${b} / ${QUESTION_COUNT}`;
    };
    body.replaceChildren(
      h('section.setup',
        {},
        h('h3', {}, '문제 유형'),
        segmented<QuizMode>(
          [
            { value: 'all', label: '골고루' },
            { value: 'A', label: TYPE_LABEL.A },
            { value: 'B', label: TYPE_LABEL.B },
            { value: 'C', label: TYPE_LABEL.C },
          ],
          mode,
          (m) => { mode = m; refreshBest(); },
        ),
        h('h3', {}, '난이도'),
        segmented<Difficulty>(
          [{ value: 'basic', label: '기본' }, { value: 'advanced', label: '응용' }],
          difficulty,
          (d) => { difficulty = d; refreshBest(); },
        ),
        bestLine,
        h('button.big.primary.start', { type: 'button', onclick: start }, `${QUESTION_COUNT}문제 시작`),
      ),
    );
  }

  function start() {
    body.replaceChildren(h('p.loading', {}, '문제를 만드는 중…'));
    // 문제 생성은 조금 걸리므로 '만드는 중' 문구가 먼저 그려지게 한다
    timers.push(window.setTimeout(() => {
      session = new QuizSession({ mode, difficulty, count: QUESTION_COUNT });
      showQuestion();
    }, 30));
  }

  function showQuestion() {
    clearExplain();
    const s = session!;
    if (s.finished) {
      showResult();
      return;
    }
    const q = s.current;
    const scale = questionScale(q);
    const feedback = h('div.feedback');
    const choiceButtons = q.choices.map((c, i) =>
      h('button.choice', { type: 'button', onclick: () => choose(i) },
        h('span.mark', {}, MARKS[i]),
        h('img', { src: visualImage(c.visual, scale), alt: `보기 ${i + 1}` }),
      ),
    );

    function choose(i: number) {
      choiceButtons.forEach((b) => (b.disabled = true));
      const correct = s.answer(i);
      choiceButtons[q.answerIndex].classList.add('correct');
      if (correct) {
        feedback.replaceChildren(h('p.ok', {}, '⭕ 정답이에요!'));
        timers.push(window.setTimeout(() => { s.next(); showQuestion(); }, 1000));
        return;
      }
      choiceButtons[i].classList.add('wrong');
      const viewerBox = h('div.explain-viewer');
      feedback.replaceChildren(
        h('div.explain',
          {},
          h('p.no', {}, `❌ 아쉬워요. 정답은 ${MARKS[q.answerIndex]}이에요.`),
          h('p.why', {}, q.choices[i].why),
          viewerBox,
          h('button.primary.next', { type: 'button', onclick: () => { s.next(); showQuestion(); } }, '다음 문제 →'),
        ),
      );
      feedback.scrollIntoView({ behavior: 'smooth', block: 'start' });
      explainViewer = new SolidViewer(viewerBox);
      explainViewer.setFigure(q.source);
      playExplain(q.question.kind === 'solid-cut' ? q.question.cut : null);
    }

    body.replaceChildren(
      h('section.question',
        {},
        h('div.progress', {}, `${s.index + 1} / ${s.questions.length}`, h('span.type-tag', {}, TYPE_LABEL[q.type])),
        h('p.prompt', {}, q.prompt),
        h('img.question-img', { src: visualImage(q.question, scale, 320), alt: '문제 그림' }),
        h('div.choices', {}, ...choiceButtons),
        feedback,
      ),
    );
  }

  /** 해설: 원래 도형이 돌아가며 회전체가 되는 모습, 유형 C면 이어서 단면을 보여준다. */
  function playExplain(cut: import('../geometry/types.ts').Cut | null) {
    const v = explainViewer!;
    const startAt = performance.now();
    const step = (now: number) => {
      if (explainViewer !== v) return;
      const deg = Math.min(360, ((now - startAt) / 2500) * 360);
      v.setAngle(deg);
      if (deg < 360) requestAnimationFrame(step);
      else if (cut) timers.push(window.setTimeout(() => v.setCut({ cut, angleDeg: 35 }), 400));
    };
    v.setAngle(0);
    requestAnimationFrame(step);
  }

  function showResult() {
    const r = session!.result();
    const key = bestKey({ mode, difficulty });
    const isBest = saveBest(storage(), key, r.score);
    const rows = (Object.keys(r.byType) as QuizType[])
      .filter((t) => r.byType[t].total > 0)
      .map((t) => h('li', {}, `${TYPE_LABEL[t]}: ${r.byType[t].correct} / ${r.byType[t].total}`));
    body.replaceChildren(
      h('section.result',
        {},
        h('p.score', {}, `${r.score} / ${r.total}`),
        isBest ? h('p.new-best', {}, '🎉 최고 기록이에요!') : null,
        h('ul.by-type', {}, ...rows),
        h('div.row.center',
          {},
          h('button.primary', { type: 'button', onclick: start }, '다시 하기'),
          h('button.tool', { type: 'button', onclick: showSetup }, '유형 바꾸기'),
          h('button.tool', { type: 'button', onclick: () => go('home') }, '홈으로'),
        ),
      ),
    );
  }

  showSetup();
  return () => clearExplain();
};
```

- [ ] **Step 7: `src/style.css` 작성**

```css
:root {
  --bg: #f6f7fb;
  --panel: #ffffff;
  --ink: #1f2433;
  --muted: #6b7285;
  --line: #e1e5ef;
  --primary: #3b6fe0;
  --primary-ink: #ffffff;
  --accent: #ff8a3d;
  --ok: #16a34a;
  --no: #e5484d;
  --radius: 16px;
  --tap: 48px;
  font-family: 'Pretendard', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif;
  color: var(--ink);
  background: var(--bg);
  -webkit-tap-highlight-color: transparent;
}

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; overscroll-behavior: none; }
#app { min-height: 100%; }
button { font: inherit; color: inherit; cursor: pointer; }
button:disabled { opacity: 0.45; cursor: default; }
[hidden] { display: none !important; }

/* 공통 */
.topbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
.topbar h2 { margin: 0; font-size: 20px; }
.back { min-height: var(--tap); padding: 0 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
.row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.row.center { justify-content: center; }
.row-label { color: var(--muted); font-size: 15px; }
.primary { min-height: var(--tap); padding: 0 20px; border: none; border-radius: 12px; background: var(--primary); color: var(--primary-ink); font-weight: 700; }
.tool { min-height: var(--tap); padding: 0 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel); font-size: 15px; }
.chip:active { background: #eef2ff; }
.segmented { display: inline-flex; padding: 4px; border-radius: 12px; background: #e9edf6; gap: 4px; flex-wrap: wrap; }
.seg { min-height: 40px; padding: 0 14px; border: none; border-radius: 9px; background: transparent; }
.seg.active { background: var(--panel); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); font-weight: 700; color: var(--primary); }
.slider { flex: 1; min-width: 140px; height: var(--tap); accent-color: var(--primary); }
.slider-label { min-width: 70px; text-align: right; font-variant-numeric: tabular-nums; }

/* 홈 */
.home { max-width: 720px; margin: 0 auto; padding: 64px 24px; text-align: center; }
.home-badge { display: inline-block; padding: 6px 14px; border-radius: 999px; background: #eef2ff; color: var(--primary); font-weight: 700; }
.home-title { font-size: 44px; margin: 16px 0 8px; }
.home-sub { color: var(--muted); font-size: 18px; margin: 0 0 40px; }
.home-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.big { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 16px; border-radius: 20px; font-size: 22px; font-weight: 800; border: none; }
.big small { font-size: 14px; font-weight: 500; opacity: 0.85; }
.big-icon { font-size: 40px; }
.big.primary { background: var(--primary); color: #fff; }
.big.secondary { background: var(--accent); color: #fff; }

/* 탐구 */
.explore { display: flex; flex-direction: column; height: 100dvh; }
.explore-body { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; min-height: 0; }
.panel { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--line); min-height: 0; }
.grid-wrap { flex: 1; min-height: 240px; position: relative; }
.grid-canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 12px; }
.message { margin: 0; min-height: 22px; color: var(--no); font-size: 15px; }
.viewer-wrap { flex: 1; position: relative; min-height: 260px; border-radius: 12px; overflow: hidden; }
.viewer { position: absolute; inset: 0; }
.viewer canvas { display: block; }
.name-tag { position: absolute; left: 12px; top: 12px; padding: 8px 14px; border-radius: 999px; background: rgba(255, 255, 255, 0.92); font-weight: 800; font-size: 18px; pointer-events: none; }
.mini-section { position: absolute; right: 10px; bottom: 10px; width: 140px; height: 140px; border-radius: 12px; border: 2px solid #f59e0b; background: #fff; pointer-events: none; }
.play { min-height: var(--tap); padding: 0 16px; border: none; border-radius: 12px; background: var(--accent); color: #fff; font-weight: 700; }

@media (orientation: portrait) {
  .explore { height: auto; min-height: 100dvh; }
  .explore-body { grid-template-columns: 1fr; }
  .grid-wrap { min-height: 46vh; }
  .viewer-wrap { min-height: 46vh; }
}

/* 문제 */
.quiz-body { max-width: 900px; margin: 0 auto; padding: 16px; }
.setup { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 24px; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--line); }
.setup h3 { margin: 8px 0 0; }
.best { color: var(--muted); }
.start { align-self: stretch; font-size: 20px; }
.loading { text-align: center; color: var(--muted); padding: 40px; }
.question { display: flex; flex-direction: column; gap: 12px; }
.progress { display: flex; align-items: center; gap: 10px; color: var(--muted); font-weight: 700; }
.type-tag { padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: var(--primary); font-size: 14px; }
.prompt { margin: 0; font-size: 20px; font-weight: 700; line-height: 1.45; }
.question-img { align-self: center; width: min(320px, 70vw); aspect-ratio: 1; border-radius: var(--radius); border: 1px solid var(--line); background: #fff; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.choice { position: relative; padding: 8px; border: 3px solid var(--line); border-radius: var(--radius); background: var(--panel); }
.choice img { display: block; width: 100%; aspect-ratio: 1; border-radius: 10px; }
.choice .mark { position: absolute; left: 12px; top: 10px; font-size: 22px; font-weight: 800; }
.choice.correct { border-color: var(--ok); background: #ecfdf3; }
.choice.wrong { border-color: var(--no); background: #fff1f1; }
.feedback .ok { font-size: 22px; font-weight: 800; color: var(--ok); text-align: center; }
.explain { display: flex; flex-direction: column; gap: 8px; padding: 16px; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--line); }
.explain .no { margin: 0; font-size: 20px; font-weight: 800; color: var(--no); }
.explain .why { margin: 0; font-size: 18px; }
.explain-viewer { position: relative; height: 280px; border-radius: 12px; overflow: hidden; }
.next { align-self: flex-end; }
.result { text-align: center; padding: 32px; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--line); }
.score { font-size: 56px; font-weight: 900; margin: 8px 0; color: var(--primary); }
.new-best { font-size: 20px; font-weight: 800; color: var(--accent); }
.by-type { list-style: none; padding: 0; font-size: 18px; line-height: 1.8; }
.choice:disabled { opacity: 1; }

/* 태블릿 가로: 문제 그림은 왼쪽, 보기는 오른쪽 */
@media (orientation: landscape) and (min-width: 900px) {
  .quiz-body { max-width: 1200px; }
  .question { display: grid; grid-template-columns: 320px 1fr; grid-template-areas: 'progress progress' 'prompt prompt' 'img choices' 'feedback feedback'; gap: 12px 20px; align-items: start; }
  .progress { grid-area: progress; }
  .prompt { grid-area: prompt; }
  .question-img { grid-area: img; width: 320px; }
  .choices { grid-area: choices; max-width: calc((100dvh - 190px) * 1.0); }
  .feedback { grid-area: feedback; }
}
```

- [ ] **Step 8: `src/main.ts` 작성**

```ts
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { exploreScreen } from './ui/explore.ts';
import { homeScreen } from './ui/home.ts';
import { quizScreen } from './ui/quiz.ts';
import { startRouter } from './ui/router.ts';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const root = document.getElementById('app')!;
if (!hasWebGL()) {
  root.innerHTML = '<p style="padding:40px;font-size:20px;text-align:center">이 기기에서는 3D를 표시할 수 없어요.</p>';
} else {
  startRouter(root, { home: homeScreen, explore: exploreScreen, quiz: quizScreen });
}

registerSW({ immediate: true });
```

- [ ] **Step 9: 확인**

화면 확인 (사람 또는 에이전트):
```bash
npm run build && npm run preview
```
브라우저에서 `http://localhost:4173/`을 1280×800, 800×1280 크기로 열어 다음을 확인한다.
- 홈: 버튼 두 개.
- 탐구: 직사각형 → "→ 원기둥". 직각삼각형 + 회전 슬라이더 200° → 주황 삼각형이 돌며 면이 쌓임. "축에서 떨어진 직사각형" + "축에 수직" → 3D에 고리 단면, 오른쪽 아래 작은 그림에 고리. "원 (축에서 떨어짐)" + "축을 포함" → 원 두 개 단면. 직접 그리기로 점 4개 찍고 첫 점 누르면 3D 생성. 축 손잡이를 끌면 3D가 바뀜.
- 문제: "단면 맞히기"·"응용" → 10문제 시작 → 보기 4개가 모두 다름. 틀리면 해설 문구와 회전 애니메이션, 끝나면 점수와 유형별 결과.
- 개발자 도구 콘솔에 오류가 없어야 한다.

- [ ] **Step 10: 커밋**

```bash
git add src/ui/dom.ts src/ui/router.ts src/ui/home.ts src/ui/explore.ts src/ui/visuals.ts src/ui/quiz.ts src/style.css src/main.ts
git commit -m "feat: 홈·탐구·문제 화면"
```

---

### Task 10: PWA 동작 확인과 GitHub Pages 배포 설정

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: main 브랜치에 push하면 테스트 → 빌드 → GitHub Pages 배포.

**주의할 점 (시제품에서 확인함):**
- `vite.config.ts`의 `base: './'`와 매니페스트 `start_url/scope: './'` 덕분에 저장소 이름과 상관없이 하위 경로에서 동작한다.
- 원격 저장소 생성과 push는 외부에 공개되는 작업이므로 사용자 확인을 받은 뒤에 한다.

- [ ] **Step 1: `.github/workflows/deploy.yml` 작성**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 확인**

PWA 확인:
1. `npm run build && npm run preview` 후 크롬 개발자 도구 → Application → Manifest에서 이름 "회전체 연습", 아이콘 3개, "Installability" 오류 없음 확인.
2. Application → Service Workers에서 sw.js가 activated 상태인지 확인.
3. Network를 Offline으로 바꾸고 새로고침 → 앱이 그대로 뜨는지 확인.
4. (배포 후, 사용자) 갤럭시탭 크롬에서 주소 열기 → 메뉴 → "앱 설치" → 홈 화면 아이콘으로 실행.

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Pages 배포 워크플로"
```

---

## 완료 조건

- `npm test` 전체 통과, `npm run build` 성공(`dist/sw.js` 생성).
- Task 9 화면 확인 항목과 Task 10 PWA 확인 항목을 모두 통과.
- 남은 TODO·`.skip`·`.only` 없음.
