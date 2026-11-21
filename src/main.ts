import './styles.css';
import { onLocaleChange, t } from './i18n';
import { LESSONS } from './lessons/registry';
import type { LessonDefinition, LessonResult, LessonSession } from './lessons/types';
import { h } from './ui/dom';
import { briefingScreen, fallbackScreen, homeScreen, resultScreen } from './ui/screens';

type View =
  | { name: 'home' }
  | { name: 'briefing'; lesson: LessonDefinition }
  | { name: 'play'; lesson: LessonDefinition }
  | { name: 'result'; lesson: LessonDefinition; result: LessonResult }
  | { name: 'fallback'; lesson: LessonDefinition };

const root = document.getElementById('app')!;
let view: View = { name: 'home' };
let session: LessonSession | null = null;

function go(next: View): void {
  session?.dispose();
  session = null;
  view = next;
  render();
  window.scrollTo(0, 0);
}

const home = (): void => go({ name: 'home' });

function render(): void {
  document.body.classList.toggle('is-playing', view.name === 'play');
  const titled = view.name === 'home' ? LESSONS[0] : view.lesson;
  document.title = titled.copy(t()).title;
  switch (view.name) {
    case 'home':
      root.replaceChildren(homeScreen(LESSONS, (lesson) => go({ name: 'briefing', lesson })));
      break;
    case 'briefing': {
      const { lesson } = view;
      root.replaceChildren(briefingScreen(lesson, () => go({ name: 'play', lesson }), home));
      break;
    }
    case 'play': {
      const { lesson } = view;
      const host = h('div', { class: 'play-host' });
      root.replaceChildren(host);
      session = lesson.start(host, {
        onComplete: (result) => go({ name: 'result', lesson, result }),
        onHome: home,
        onRetry: () => go({ name: 'play', lesson }),
        // May fire during start(); defer so the session reference is set first.
        onUnsupported: () => queueMicrotask(() => go({ name: 'fallback', lesson })),
      });
      return;
    }
    case 'result': {
      const { lesson, result } = view;
      root.replaceChildren(resultScreen(lesson, result, () => go({ name: 'play', lesson }), home));
      break;
    }
    case 'fallback': {
      const { lesson } = view;
      root.replaceChildren(fallbackScreen(lesson, () => go({ name: 'play', lesson }), home));
      break;
    }
  }
  root.querySelector<HTMLElement>('h1')?.setAttribute('tabindex', '-1');
}

onLocaleChange(() => {
  // The running scene relabels itself; every other screen re-renders.
  if (view.name !== 'play') {
    const focusedLang = (document.activeElement as HTMLElement | null)?.getAttribute('lang');
    render();
    if (focusedLang) root.querySelector<HTMLElement>(`.lang-switch [lang="${focusedLang}"]`)?.focus();
  }
});

render();
