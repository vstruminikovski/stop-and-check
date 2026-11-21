import { onLocaleChange, t } from '../../i18n';
import { DriveInput } from '../../game/input';
import { createRenderer } from '../../game/renderer';
import { createPracticeTouchControls } from '../../game/touchControls';
import { Vehicle } from '../../game/vehicle';
import { h, icon, ICONS } from '../../ui/dom';
import { langSwitch } from '../../ui/langSwitch';
import type { LessonResult, LessonSession, SessionHooks } from '../types';
import { PracticeScene } from './scene';
import type { ExerciseSpec } from './types';

/** Briefing stays on screen at the start until the learner has driven a few metres. */
const GOAL_MIN_SECONDS = 5;
const GOAL_DISTANCE = 3;

function prefersTouch(): boolean {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function startPractice(spec: ExerciseSpec, host: HTMLElement, hooks: SessionHooks): LessonSession {
  const canvas = h('canvas', { class: 'scene-canvas', 'aria-hidden': 'true' });
  const renderer = createRenderer(canvas);
  if (!renderer) {
    hooks.onUnsupported();
    return { relabel() {}, dispose() {} };
  }

  const car = new Vehicle(spec.start);
  const judge = spec.createJudge();
  const world = new PracticeScene(renderer, spec);
  if (import.meta.env.DEV) Object.assign(window, { __practice: { car, judge } });

  let paused = false;
  let finished = false;
  let elapsed = 0;
  let travelled = 0;
  let raf = 0;
  let last = performance.now();

  const onReverse = (): void => {
    if (paused || finished) return;
    if (!car.toggleReverse()) gearChip.classList.add('is-refused');
    window.setTimeout(() => gearChip.classList.remove('is-refused'), 500);
  };
  const onParkingBrake = (): void => {
    if (paused || finished) return;
    car.toggleParkingBrake();
  };
  const input = new DriveInput(() => togglePause(), { onReverse, onParkingBrake });
  const touch = createPracticeTouchControls(input, { onReverse, onParkingBrake });

  // --- HUD -------------------------------------------------------------
  const speedValue = h('span', { class: 'speed-value' }, '0');
  const speed = h('div', { class: 'hud-speed', 'aria-hidden': 'true' }, speedValue, h('span', { class: 'speed-unit' }, 'km/h'));
  const gearLetter = h('span', { class: 'gear-letter' }, 'D');
  const gearLabel = h('span', { class: 'chip-label' });
  const gearChip = h('div', { class: 'check-chip gear-chip' }, gearLetter, gearLabel);
  const pbLabel = h('span', { class: 'chip-label' });
  const pbChip = h('div', { class: 'check-chip pb-chip' }, icon(ICONS.parkingBrake), pbLabel);
  const status = h('div', { class: 'hud-checks', role: 'status', 'aria-live': 'polite' }, gearChip, pbChip);
  const bannerText = h('span', { class: 'banner-text' });
  const banner = h('div', { class: 'hud-banner', 'data-state': 'goal' }, bannerText);
  const pauseLabel = h('span', { class: 'btn-label' });
  const pauseButton = h('button', { type: 'button', class: 'hud-pause', onclick: () => togglePause() }, icon(ICONS.pause), pauseLabel);

  const hintReverse = h('span');
  const hintPb = h('span');
  const hintPause = h('span');
  const keyHints = h(
    'div',
    { class: 'key-hints', 'aria-hidden': 'true' },
    h('div', { class: 'key-row' }, h('kbd', {}, 'W'), h('kbd', {}, 'A'), h('kbd', {}, 'S'), h('kbd', {}, 'D'), h('span', { class: 'key-sep' }, '/'), h('kbd', {}, '↑'), h('kbd', {}, '←'), h('kbd', {}, '↓'), h('kbd', {}, '→')),
    h('div', { class: 'key-row' }, h('kbd', {}, 'R'), hintReverse),
    h('div', { class: 'key-row' }, h('kbd', {}, 'Space'), hintPb),
    h('div', { class: 'key-row' }, h('kbd', {}, 'Esc'), hintPause),
  );
  const hud = h(
    'div',
    { class: 'hud' },
    h('div', { class: 'hud-top' }, speed, h('div', { class: 'hud-center' }, banner, status), pauseButton),
    keyHints,
  );

  // --- Pause overlay ---------------------------------------------------
  const pauseOverlay = h('div', { class: 'overlay', hidden: true });
  const renderPauseOverlay = (): void => {
    const d = t();
    pauseOverlay.replaceChildren(
      h(
        'div',
        { class: 'card overlay-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pause-title' },
        h('h2', { id: 'pause-title', class: 'overlay-title' }, d.common.pause),
        langSwitch(),
        h(
          'div',
          { class: 'stack' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => togglePause(false) }, d.common.continue),
          h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => hooks.onRetry() }, d.common.retry),
          h('button', { type: 'button', class: 'btn btn-plain', onclick: () => hooks.onHome() }, d.modules.practice.backToModule),
        ),
      ),
    );
  };

  const stage = h('div', { class: 'stage' }, canvas, hud);
  const root = h('div', { class: 'play practice' }, stage, touch.element, pauseOverlay);
  root.classList.toggle('is-touch', prefersTouch());
  const onFirstTouch = (): void => {
    root.classList.add('is-touch');
  };
  window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
  host.replaceChildren(root);

  // --- Copy ------------------------------------------------------------
  const relabel = (): void => {
    const d = t();
    const c = d.common;
    pauseLabel.textContent = c.pause;
    pauseButton.setAttribute('aria-label', c.pause);
    bannerText.textContent = d.exercises[spec.id].briefing;
    gearLabel.textContent = c.reverse;
    pbLabel.textContent = c.parkingBrake;
    hintReverse.textContent = c.reverse;
    hintPb.textContent = c.parkingBrake;
    hintPause.textContent = c.pause;
    touch.reverse.querySelector('span:last-child')!.textContent = c.reverse;
    touch.parkingBrake.querySelector('span')!.textContent = c.parkingBrake;
    touch.reverse.setAttribute('aria-label', c.reverse);
    touch.parkingBrake.setAttribute('aria-label', c.parkingBrake);
    touch.left.setAttribute('aria-label', c.steerLeft);
    touch.right.setAttribute('aria-label', c.steerRight);
    touch.brake.setAttribute('aria-label', c.brake);
    touch.accelerate.setAttribute('aria-label', c.accelerate);
    if (!pauseOverlay.hidden) renderPauseOverlay();
    updateHud();
  };

  function updateHud(): void {
    speedValue.textContent = String(Math.round(Math.abs(car.speed) * 3.6));
    const reverse = car.gear === 'R';
    gearLetter.textContent = car.gear;
    gearChip.classList.toggle('is-reverse', reverse);
    gearLabel.hidden = !reverse;
    pbChip.hidden = !car.parkingBrake;
    banner.hidden = !(elapsed < GOAL_MIN_SECONDS || travelled < GOAL_DISTANCE);

    const cue = judge.cue(car);
    touch.reverse.classList.toggle('is-on', reverse);
    touch.reverse.setAttribute('aria-pressed', String(reverse));
    touch.parkingBrake.classList.toggle('is-on', car.parkingBrake);
    touch.parkingBrake.setAttribute('aria-pressed', String(car.parkingBrake));
    touch.reverse.classList.toggle('is-cue', cue === 'reverse');
    touch.parkingBrake.classList.toggle('is-cue', cue === 'parkingBrake');
    hintReverse.parentElement!.classList.toggle('is-cue', cue === 'reverse');
    hintPb.parentElement!.classList.toggle('is-cue', cue === 'parkingBrake');
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
    const snap = input.snapshot();
    car.step(dt, snap, spec.terrain, spec.bounds);
    travelled += Math.abs(car.speed) * dt;
    judge.update(car, dt);
    world.update(car, judge.violating, dt);
    world.render();
    updateHud();

    if (judge.done) {
      finished = true;
      const state = judge.checklist();
      const result: LessonResult = { items: spec.checklist.map((key) => ({ key, completed: state[key] === true })) };
      window.setTimeout(() => hooks.onComplete(result), 450);
    }
  };

  const offLocale = onLocaleChange(relabel);
  relabel();
  world.update(car, false, 0);
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
