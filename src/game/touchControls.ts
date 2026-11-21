import { h, icon, ICONS } from '../ui/dom';
import type { DriveAction, DriveInput } from './input';

export interface TouchControls {
  /** Bottom panel (portrait) / edge clusters (landscape) with the driving controls. */
  element: HTMLElement;
  lookLeft: HTMLButtonElement;
  lookRight: HTMLButtonElement;
  left: HTMLButtonElement;
  right: HTMLButtonElement;
  brake: HTMLButtonElement;
  accelerate: HTMLButtonElement;
  /** Updates the visible pressed state for keyboard input too. */
  sync(): void;
}

function bindHold(button: HTMLButtonElement, action: DriveAction, input: DriveInput): void {
  const active = new Set<number>();
  const release = (e: PointerEvent): void => {
    if (!active.delete(e.pointerId)) return;
    input.setTouch(action, false);
  };
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (active.has(e.pointerId)) return;
    active.add(e.pointerId);
    try {
      button.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    input.setTouch(action, true);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function createTouchControls(input: DriveInput): TouchControls {
  const make = (action: DriveAction, cls: string, content: Node[]): HTMLButtonElement => {
    const button = h('button', { type: 'button', class: `tc ${cls}`, 'data-action': action }, ...content);
    bindHold(button, action, input);
    return button;
  };

  const lookLeft = make('lookLeft', 'tc-look tc-look-left', [icon(ICONS.eyeLeft), h('span')]);
  const lookRight = make('lookRight', 'tc-look tc-look-right', [h('span'), icon(ICONS.eyeRight)]);
  const left = make('left', 'tc-steer', [icon(ICONS.left)]);
  const right = make('right', 'tc-steer', [icon(ICONS.right)]);
  const brake = make('brake', 'tc-pedal tc-brake', [icon(ICONS.down)]);
  const accelerate = make('accelerate', 'tc-pedal tc-gas', [icon(ICONS.up)]);

  const element = h(
    'div',
    { class: 'touch-controls' },
    h('div', { class: 'tc-row tc-looks' }, lookLeft, lookRight),
    h(
      'div',
      { class: 'tc-row tc-drive' },
      h('div', { class: 'tc-cluster tc-cluster-steer' }, left, right),
      h('div', { class: 'tc-cluster tc-cluster-pedals' }, brake, accelerate),
    ),
  );

  const buttons = [lookLeft, lookRight, left, right, brake, accelerate];
  return {
    element,
    lookLeft,
    lookRight,
    left,
    right,
    brake,
    accelerate,
    sync() {
      for (const b of buttons) b.classList.toggle('is-down', input.isDown(b.dataset.action as DriveAction));
    },
  };
}
