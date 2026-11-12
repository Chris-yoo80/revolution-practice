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
