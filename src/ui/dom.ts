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

/** segmented 묶음의 선택 표시만 바꾼다(onSelect는 부르지 않음). */
export function selectSegment(wrap: HTMLElement, value: string): void {
  wrap.querySelectorAll<HTMLButtonElement>('button.seg').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === value);
  });
}
