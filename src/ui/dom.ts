type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

/** Tiny element factory: h('button', { class: 'btn', onclick: fn }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** Parse a static, trusted SVG/HTML snippet (icons only — never user or copy text). */
export function icon(markup: string): Element {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  return tpl.content.firstElementChild as Element;
}

export const ICONS = {
  stop: `<svg class="stop-icon" viewBox="0 0 100 100" aria-hidden="true">
    <polygon points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30" fill="var(--stop)"/>
    <polygon points="32,8 68,8 92,32 92,68 68,92 32,92 8,68 8,32" fill="none" stroke="#fff" stroke-width="4"/>
    <text x="50" y="60" text-anchor="middle" font-size="27" font-weight="800" fill="#fff" font-family="system-ui, -apple-system, sans-serif" letter-spacing="1">STOP</text>
  </svg>`,
  road: `<svg viewBox="0 0 32 32" aria-hidden="true" class="mark">
    <rect width="32" height="32" rx="9" fill="var(--accent)"/>
    <path d="M12 26 L14.5 6 M20 26 L17.5 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M16 23v-2.5M16 17v-2.5M16 11v-2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  practice: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 9A7 7 0 1 0 19 14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M19.5 4.5V9.5H14.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/></svg>`,
  home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 7-6.5 7-2.8 0-4.4-1.6-5.6-3.6L3.5 13a1.4 1.4 0 0 1 2.3-1.6L8 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  go: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 12.5l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  eyeLeft: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l-6 6 6 6M4.5 12H20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  eyeRight: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l6 6-6 6M19.5 12H4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  up: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7 9h-4.5v7h-5v-7H5z" fill="currentColor"/></svg>`,
  down: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20l7-9h-4.5V4h-5v7H5z" fill="currentColor"/></svg>`,
  left: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-8 7 8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  right: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l8 7-8 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  parkingBrake: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 16.5v-9h3a2.6 2.6 0 0 1 0 5.2h-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 6.5a10 10 0 0 0 0 11M20 6.5a10 10 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity=".6"/></svg>`,
  cones: `<svg viewBox="0 0 100 100" class="stop-icon" aria-hidden="true"><rect x="4" y="4" width="92" height="92" rx="24" fill="#8d929a"/><path d="M20 30h60M20 70h60" stroke="#fff" stroke-width="4" stroke-dasharray="8 6"/><path d="M38 78l8-34h8l8 34z" fill="#f07a2a"/><path d="M42 62h16" stroke="#fff" stroke-width="5"/><rect x="32" y="77" width="36" height="5" rx="2" fill="#f07a2a"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
} as const;
