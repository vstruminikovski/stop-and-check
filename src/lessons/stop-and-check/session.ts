import { onLocaleChange, t } from '../../i18n';
import { DriveInput } from '../../game/input';
import { createRenderer } from '../../game/renderer';
import { createTouchControls } from '../../game/touchControls';
import { h, icon, ICONS } from '../../ui/dom';
import { langSwitch } from '../../ui/langSwitch';
import type { LessonResult, LessonSession, SessionHooks } from '../types';
import { StopCheckLogic, type ChecklistState } from './logic';
import { StopCheckScene } from './scene';

export const CHECKLIST_KEYS: readonly (keyof ChecklistState)[] = [
  'stoppedBeforeLine',
  'checkedBothWays',
  'waitedWhileUnsafe',
  'proceededWhenClear',
];

type BannerState = 'goal' | 'wait' | 'check' | 'clear' | null;

const GOAL_SECONDS = 6;

function prefersTouch(): boolean {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function startStopAndCheck(host: HTMLElement, hooks: SessionHooks): LessonSession {
  const canvas = h('canvas', { class: 'scene-canvas', 'aria-hidden': 'true' });
  const renderer = createRenderer(canvas);
  if (!renderer) {
    hooks.onUnsupported();
    return { relabel() {}, dispose() {} };
  }

  const logic = new StopCheckLogic();
  if (import.meta.env.DEV) (window as unknown as { __lesson?: StopCheckLogic }).__lesson = logic;
  const world = new StopCheckScene(renderer);
  let paused = false;
  let finished = false;
  let elapsed = 0;
  let raf = 0;
  let last = performance.now();

  const input = new DriveInput(() => togglePause());
  const touch = createTouchControls(input);

  // --- HUD -------------------------------------------------------------
  const speedValue = h('span', { class: 'speed-value' }, '0');
  const speed = h('div', { class: 'hud-speed', 'aria-hidden': 'true' }, speedValue, h('span', { class: 'speed-unit' }, 'km/h'));
  const bannerIcon = h('span', { class: 'banner-icon' });
  const bannerText = h('span', { class: 'banner-text' });
  const banner = h('div', { class: 'hud-banner', role: 'status', 'aria-live': 'polite' }, bannerIcon, bannerText);
  const pauseLabel = h('span', { class: 'btn-label' });
  const pauseButton = h('button', { type: 'button', class: 'hud-pause', onclick: () => togglePause() }, icon(ICONS.pause), pauseLabel);

  const chipLeftLabel = h('span');
  const chipRightLabel = h('span');
  const chipLeft = h('div', { class: 'check-chip' }, icon(ICONS.eyeLeft), chipLeftLabel, h('span', { class: 'chip-tick' }, icon(ICONS.check)));
  const chipRight = h('div', { class: 'check-chip' }, chipRightLabel, icon(ICONS.eyeRight), h('span', { class: 'chip-tick' }, icon(ICONS.check)));
  const chips = h('div', { class: 'hud-checks' }, chipLeft, chipRight);

  const hintLookLeft = h('span');
  const hintLookRight = h('span');
  const hintPause = h('span');
  const keyHints = h(
    'div',
    { class: 'key-hints', 'aria-hidden': 'true' },
    h('div', { class: 'key-row' }, h('kbd', {}, 'W'), h('kbd', {}, 'A'), h('kbd', {}, 'S'), h('kbd', {}, 'D'), h('span', { class: 'key-sep' }, '/'), h('kbd', {}, '↑'), h('kbd', {}, '←'), h('kbd', {}, '↓'), h('kbd', {}, '→')),
    h('div', { class: 'key-row' }, h('kbd', {}, 'Q'), hintLookLeft),
    h('div', { class: 'key-row' }, h('kbd', {}, 'E'), hintLookRight),
    h('div', { class: 'key-row' }, h('kbd', {}, 'Esc'), hintPause),
  );

  const hud = h(
    'div',
    { class: 'hud' },
    h('div', { class: 'hud-top' }, speed, h('div', { class: 'hud-center' }, banner, chips), pauseButton),
    keyHints,
  );

  // --- Pause overlay ---------------------------------------------------
  const pauseOverlay = h('div', { class: 'overlay', hidden: true });
  const renderPauseOverlay = (): void => {
    const d = t().common;
    pauseOverlay.replaceChildren(
      h(
        'div',
        { class: 'card overlay-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title' },
        h('h2', { id: 'pause-title', class: 'overlay-title' }, d.pause),
        langSwitch(),
        h(
          'div',
          { class: 'stack' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => togglePause(false) }, d.continue),
          h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => hooks.onRetry() }, d.retry),
          h('button', { type: 'button', class: 'btn btn-plain', onclick: () => hooks.onHome() }, d.home),
        ),
      ),
    );
  };

  const stage = h('div', { class: 'stage' }, canvas, hud);
  const root = h('div', { class: 'play' }, stage, touch.element, pauseOverlay);
  const applyInputMode = (isTouch: boolean): void => {
    root.classList.toggle('is-touch', isTouch);
  };
  applyInputMode(prefersTouch());
  const onFirstTouch = (): void => applyInputMode(true);
  window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
  host.replaceChildren(root);

  // --- Copy ------------------------------------------------------------
  let bannerState: BannerState | undefined;
  const relabel = (): void => {
    const d = t().common;
    pauseLabel.textContent = d.pause;
    pauseButton.setAttribute('aria-label', d.pause);
    chipLeftLabel.textContent = d.lookLeft;
    chipRightLabel.textContent = d.lookRight;
    hintLookLeft.textContent = d.lookLeft;
    hintLookRight.textContent = d.lookRight;
    hintPause.textContent = d.pause;
    touch.lookLeft.querySelector('span')!.textContent = d.lookLeft;
    touch.lookRight.querySelector('span')!.textContent = d.lookRight;
    touch.lookLeft.setAttribute('aria-label', d.lookLeft);
    touch.lookRight.setAttribute('aria-label', d.lookRight);
    touch.left.setAttribute('aria-label', d.steerLeft);
    touch.right.setAttribute('aria-label', d.steerRight);
    touch.brake.setAttribute('aria-label', d.brake);
    touch.accelerate.setAttribute('aria-label', d.accelerate);
    if (!pauseOverlay.hidden) renderPauseOverlay();
    bannerState = undefined; // force banner text refresh
    updateHud();
  };

  const setBanner = (state: BannerState): void => {
    if (state === bannerState) return;
    bannerState = state;
    banner.dataset.state = state ?? 'none';
    banner.hidden = state === null;
    const d = t();
    const lesson = d.lessons['stop-and-check'];
    bannerIcon.replaceChildren();
    switch (state) {
      case 'goal':
        bannerText.textContent = lesson.goal;
        break;
      case 'wait':
        bannerIcon.append(icon(ICONS.hand));
        bannerText.textContent = d.common.wait;
        break;
      case 'check':
        bannerIcon.append(icon(logic.checkedLeft ? ICONS.eyeRight : ICONS.eyeLeft));
        bannerText.textContent = logic.checkedLeft ? d.common.lookRight : d.common.lookLeft;
        break;
      case 'clear':
        bannerIcon.append(icon(ICONS.go));
        bannerText.textContent = d.common.wayClear;
        break;
      default:
        bannerText.textContent = '';
    }
  };

  let lastCheckKey = '';
  function updateHud(): void {
    speedValue.textContent = String(Math.round(logic.speed * 3.6));
    const atJunction = logic.phase === 'atJunction';
    let state: BannerState = null;
    if (atJunction) {
      if (!logic.isSafe) state = 'wait';
      else if (!logic.checkedBoth) state = 'check';
      else state = 'clear';
    } else if (logic.phase === 'approach' && elapsed < GOAL_SECONDS) {
      state = 'goal';
    }
    // The "check" banner text depends on which side is still missing.
    const checkKey = `${logic.checkedLeft}${logic.checkedRight}`;
    if (state === 'check' && checkKey !== lastCheckKey) bannerState = undefined;
    lastCheckKey = checkKey;
    setBanner(state);
    banner.classList.toggle('is-holding', logic.hold !== null && logic.speed === 0 && input.isDown('accelerate'));

    chips.hidden = !atJunction;
    chipLeft.classList.toggle('is-done', logic.checkedLeft);
    chipRight.classList.toggle('is-done', logic.checkedRight);
    touch.lookLeft.classList.toggle('is-done', logic.checkedLeft);
    touch.lookRight.classList.toggle('is-done', logic.checkedRight);
    touch.element.classList.toggle('is-checking', atJunction && !logic.checkedBoth);
    touch.sync();
  }

  // --- Layout ----------------------------------------------------------
  const resize = (): void => {
    const rect = stage.getBoundingClientRect();
    world.resize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
    world.render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);

  // --- Pause -----------------------------------------------------------
  function togglePause(force?: boolean): void {
    if (finished) return;
    const next = force ?? !paused;
    if (next === paused) return;
    paused = next;
    input.clear();
    root.classList.toggle('is-paused', paused);
    pauseOverlay.hidden = !paused;
    if (paused) {
      renderPauseOverlay();
      pauseOverlay.querySelector<HTMLButtonElement>('.btn-primary')?.focus();
    } else {
      last = performance.now();
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }

  const onVisibility = (): void => {
    if (document.hidden) togglePause(true);
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onContextLost = (e: Event): void => {
    e.preventDefault();
    if (!finished) hooks.onUnsupported();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  // --- Loop ------------------------------------------------------------
  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (paused || finished) return;

    elapsed += dt;
    logic.step(dt, input.snapshot());
    world.update(logic, dt);
    world.render();
    updateHud();

    if (logic.phase === 'done') {
      finished = true;
      const state = logic.checklist();
      const result: LessonResult = { items: CHECKLIST_KEYS.map((key) => ({ key, completed: state[key] })) };
      window.setTimeout(() => hooks.onComplete(result), 350);
    }
  };

  const offLocale = onLocaleChange(relabel);
  relabel();
  world.update(logic, 0);
  resize();
  raf = requestAnimationFrame(frame);

  return {
    relabel,
    dispose() {
      cancelAnimationFrame(raf);
      finished = true;
      offLocale();
      observer.disconnect();
      input.dispose();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('touchstart', onFirstTouch);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      world.dispose();
      renderer.dispose();
    },
  };
}
