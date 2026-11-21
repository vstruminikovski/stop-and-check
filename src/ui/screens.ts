import { t } from '../i18n';
import type { LessonDefinition, LessonResult } from '../lessons/types';
import { getProgress } from '../progress';
import { h, icon, ICONS } from './dom';
import { langSwitch } from './langSwitch';

function isTouchDevice(): boolean {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/** Where the screen's back action leads: home, or the module an exercise belongs to. */
export interface Nav {
  label: string;
  onBack: () => void;
  kind: 'home' | 'module';
}

function header(nav?: Nav): HTMLElement {
  return h(
    'header',
    { class: 'topbar' },
    nav
      ? h(
          'button',
          { type: 'button', class: 'btn-ghost', 'aria-label': nav.label, onclick: nav.onBack },
          icon(nav.kind === 'home' ? ICONS.home : ICONS.back),
          h('span', {}, nav.label),
        )
      : h('div', { class: 'brand' }, icon(ICONS.road)),
    langSwitch(),
  );
}

function page(nav: Nav | undefined, ...content: Node[]): HTMLElement {
  return h('div', { class: 'page' }, header(nav), h('main', { class: 'page-main' }, ...content));
}

const isPractice = (lesson: LessonDefinition): boolean => lesson.module !== undefined;

export interface ModuleEntry {
  title: string;
  exercises: readonly LessonDefinition[];
  onOpen: () => void;
}

export function homeScreen(
  lessons: readonly LessonDefinition[],
  onStart: (lesson: LessonDefinition) => void,
  modules: readonly ModuleEntry[] = [],
): HTMLElement {
  const d = t();
  const list = h('ul', { class: 'lesson-list' });
  for (const lesson of lessons) {
    const copy = lesson.copy(d);
    list.append(
      h(
        'li',
        { class: 'card lesson-card' },
        h('div', { class: 'lesson-art' }, icon(ICONS.stop)),
        h(
          'div',
          { class: 'lesson-body' },
          h('h1', { class: 'lesson-title' }, copy.title),
          h('p', { class: 'lesson-goal' }, copy.goal),
          h('button', { type: 'button', class: 'btn btn-primary btn-large', onclick: () => onStart(lesson) }, d.common.start),
        ),
      ),
    );
  }
  for (const mod of modules) {
    const done = mod.exercises.filter((e) => getProgress(e.id) === 'completed').length;
    list.append(
      h(
        'li',
        { class: 'card module-card' },
        h(
          'button',
          { type: 'button', class: 'module-open', onclick: mod.onOpen },
          h('span', { class: 'lesson-art module-art' }, icon(ICONS.cones)),
          h('span', { class: 'module-body' }, h('span', { class: 'module-title' }, mod.title), h('span', { class: 'module-count', 'aria-hidden': 'true' }, icon(ICONS.check), `${done} / ${mod.exercises.length}`)),
          h('span', { class: 'module-chevron' }, icon(ICONS.chevron)),
        ),
      ),
    );
  }
  return page(undefined, list);
}

/** Practice module: the list of exercises with locally saved status. */
export function moduleScreen(
  exercises: readonly LessonDefinition[],
  onStart: (lesson: LessonDefinition) => void,
  nav: Nav,
): HTMLElement {
  const d = t();
  const m = d.modules.practice;
  const list = h('ol', { class: 'exercise-list' });
  exercises.forEach((lesson, i) => {
    const copy = lesson.copy(d);
    const status = getProgress(lesson.id);
    list.append(
      h(
        'li',
        { class: 'card exercise-card' },
        h('span', { class: 'exercise-number', 'aria-hidden': 'true' }, String(i + 1)),
        h(
          'div',
          { class: 'exercise-body' },
          h('h2', { class: 'exercise-title' }, copy.title),
          status
            ? h(
                'span',
                { class: `status-pill ${status === 'completed' ? 'is-done' : 'is-practice'}` },
                icon(status === 'completed' ? ICONS.check : ICONS.practice),
                status === 'completed' ? m.completed : m.needsPractice,
              )
            : null,
        ),
        h('button', { type: 'button', class: 'btn btn-primary exercise-start', onclick: () => onStart(lesson) }, m.startExercise),
      ),
    );
  });
  return page(
    nav,
    h('h1', { class: 'module-heading' }, m.title),
    list,
    h('p', { class: 'disclaimer module-disclaimer' }, m.disclaimer),
  );
}

function practiceLegend(): HTMLElement {
  const c = t().common;
  if (isTouchDevice()) {
    return h(
      'div',
      { class: 'legend legend-touch', 'aria-hidden': 'true' },
      h('span', { class: 'legend-pill' }, h('b', {}, 'R'), c.reverse),
      h('span', { class: 'legend-pill' }, icon(ICONS.parkingBrake), c.parkingBrake),
    );
  }
  const row = (keys: string[], label?: string): HTMLElement =>
    h('div', { class: 'legend-row' }, h('span', { class: 'legend-keys' }, ...keys.map((k) => h('kbd', {}, k))), label ? h('span', {}, label) : null);
  return h(
    'div',
    { class: 'legend', 'aria-hidden': 'true' },
    row(['W', 'A', 'S', 'D']),
    row(['↑', '←', '↓', '→']),
    row(['R'], c.reverse),
    row(['Space'], c.parkingBrake),
    row(['Esc'], c.pause),
  );
}

function controlsLegend(): HTMLElement {
  const c = t().common;
  if (isTouchDevice()) {
    return h(
      'div',
      { class: 'legend legend-touch', 'aria-hidden': 'true' },
      h('span', { class: 'legend-pill' }, icon(ICONS.eyeLeft), c.lookLeft),
      h('span', { class: 'legend-pill' }, c.lookRight, icon(ICONS.eyeRight)),
    );
  }
  const row = (keys: string[], label?: string): HTMLElement =>
    h('div', { class: 'legend-row' }, h('span', { class: 'legend-keys' }, ...keys.map((k) => h('kbd', {}, k))), label ? h('span', {}, label) : null);
  return h(
    'div',
    { class: 'legend', 'aria-hidden': 'true' },
    row(['W', 'A', 'S', 'D']),
    row(['↑', '←', '↓', '→']),
    row(['Q'], c.lookLeft),
    row(['E'], c.lookRight),
    row(['Esc'], c.pause),
  );
}

export function briefingScreen(lesson: LessonDefinition, onContinue: () => void, nav: Nav): HTMLElement {
  const d = t();
  const copy = lesson.copy(d);
  const practice = isPractice(lesson);
  return page(
    nav,
    h(
      'section',
      { class: 'card briefing' },
      h('div', { class: 'briefing-art' }, icon(practice ? ICONS.cones : ICONS.stop)),
      h('h1', { class: 'screen-title' }, copy.title),
      copy.goal ? h('p', { class: 'lead' }, copy.goal) : null,
      h('p', { class: 'briefing-text' }, copy.briefing),
      practice ? practiceLegend() : controlsLegend(),
      h(
        'button',
        { type: 'button', class: 'btn btn-primary btn-large', onclick: onContinue },
        practice ? d.modules.practice.startExercise : d.common.continue,
      ),
      h('p', { class: 'disclaimer' }, practice ? d.modules.practice.disclaimer : d.common.disclaimer),
    ),
  );
}

export function resultScreen(
  lesson: LessonDefinition,
  result: LessonResult,
  onRetry: () => void,
  nav: Nav,
): HTMLElement {
  const d = t();
  const copy = lesson.copy(d);
  const practice = isPractice(lesson);
  const done = practice ? d.modules.practice.completed : d.common.completed;
  const needs = practice ? d.modules.practice.needsPractice : d.common.needsPractice;
  const allDone = result.items.every((item) => item.completed);

  const list = h('ul', { class: 'checklist' });
  for (const item of result.items) {
    list.append(
      h(
        'li',
        { class: `check-item ${item.completed ? 'is-done' : 'is-practice'}` },
        h('span', { class: 'check-mark', role: 'img', 'aria-label': item.completed ? done : needs }, icon(item.completed ? ICONS.check : ICONS.practice)),
        h('span', { class: 'check-label' }, copy.checklist[item.key] ?? item.key),
      ),
    );
  }

  return page(
    nav,
    h(
      'section',
      { class: `card result ${allDone ? 'is-positive' : 'is-retry'}` },
      h('div', { class: 'result-badge' }, icon(allDone ? ICONS.check : ICONS.practice)),
      h('h1', { class: 'screen-title' }, allDone ? d.common.positiveResult : d.common.retryResult),
      h('p', { class: 'result-lesson' }, copy.title),
      list,
      allDone || !copy.retryGuidance ? null : h('p', { class: 'guidance' }, copy.retryGuidance),
      h(
        'div',
        { class: 'actions' },
        h('button', { type: 'button', class: `btn ${allDone ? 'btn-secondary' : 'btn-primary'} btn-large`, onclick: onRetry }, d.common.retry),
        h('button', { type: 'button', class: 'btn btn-plain btn-large', onclick: nav.onBack }, nav.label),
      ),
      h('p', { class: 'disclaimer' }, practice ? d.modules.practice.disclaimer : d.common.disclaimer),
    ),
  );
}

/** Shown when the device cannot render the 3D scene: the lesson content without the simulation. */
export function fallbackScreen(lesson: LessonDefinition, onRetry: () => void, nav: Nav): HTMLElement {
  const d = t();
  const copy = lesson.copy(d);
  return page(
    nav,
    h(
      'section',
      { class: 'card briefing fallback' },
      h('div', { class: 'fallback-art', 'aria-hidden': 'true' }, isPractice(lesson) ? icon(ICONS.cones) : junctionDiagram()),
      h('h1', { class: 'screen-title' }, copy.title),
      copy.goal ? h('p', { class: 'lead' }, copy.goal) : null,
      h('p', { class: 'briefing-text' }, copy.briefing),
      h(
        'div',
        { class: 'actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-large', onclick: nav.onBack }, nav.label),
        h('button', { type: 'button', class: 'btn btn-plain btn-large', onclick: onRetry }, d.common.retry),
      ),
    ),
  );
}

/** Static top-down sketch of the junction for the no-3D fallback. */
function junctionDiagram(): Element {
  return icon(`<svg viewBox="0 0 240 160" class="junction-diagram">
    <rect width="240" height="160" rx="18" fill="var(--grass)"/>
    <rect x="0" y="52" width="240" height="40" fill="var(--asphalt)"/>
    <rect x="100" y="0" width="40" height="160" fill="var(--asphalt)"/>
    <path d="M0 72h90M150 72h90" stroke="#fff" stroke-width="2" stroke-dasharray="10 8"/>
    <path d="M120 100v60" stroke="#fff" stroke-width="2"/>
    <rect x="121" y="96" width="18" height="3" fill="#fff"/>
    <polygon points="146,92 150,88 156,88 160,92 160,98 156,102 150,102 146,98" fill="var(--stop)"/>
    <rect x="124" y="120" width="12" height="20" rx="3" fill="var(--accent)"/>
    <path d="M130 116v-10" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
    <path d="M126 110l4-5 4 5" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="34" y="78" width="20" height="10" rx="3" fill="#f2f2f0" stroke="#c9ccd1"/>
    <rect x="186" y="56" width="20" height="10" rx="3" fill="#e8833a"/>
  </svg>`);
}
