export type DriveAction = 'accelerate' | 'brake' | 'left' | 'right' | 'lookLeft' | 'lookRight';

// Physical key codes, so controls work with Macedonian/Albanian keyboard layouts too.
const KEY_MAP: Record<string, DriveAction> = {
  KeyW: 'accelerate',
  ArrowUp: 'accelerate',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyQ: 'lookLeft',
  KeyE: 'lookRight',
};

export interface InputToggles {
  onReverse?: () => void;
  onParkingBrake?: () => void;
}

/** Merges keyboard and on-screen touch input into one pressed-state snapshot. */
export class DriveInput {
  private keys = new Set<DriveAction>();
  private touch = new Map<DriveAction, number>();
  private onPauseToggle: () => void;
  private toggles: InputToggles;

  /** Toggle keys (R, Space) are only captured when a handler is supplied. */
  constructor(onPauseToggle: () => void, toggles: InputToggles = {}) {
    this.onPauseToggle = onPauseToggle;
    this.toggles = toggles;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clear);
  }

  isDown(action: DriveAction): boolean {
    return this.keys.has(action) || (this.touch.get(action) ?? 0) > 0;
  }

  snapshot(): Record<DriveAction, boolean> {
    return {
      accelerate: this.isDown('accelerate'),
      brake: this.isDown('brake'),
      left: this.isDown('left'),
      right: this.isDown('right'),
      lookLeft: this.isDown('lookLeft'),
      lookRight: this.isDown('lookRight'),
    };
  }

  /** Touch buttons call this; counts support several fingers on one control. */
  setTouch(action: DriveAction, down: boolean): void {
    const next = Math.max(0, (this.touch.get(action) ?? 0) + (down ? 1 : -1));
    this.touch.set(action, next);
  }

  clear = (): void => {
    this.keys.clear();
    this.touch.clear();
  };

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' || e.key === 'Escape') {
      e.preventDefault();
      if (!e.repeat) this.onPauseToggle();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const toggle = e.code === 'KeyR' ? this.toggles.onReverse : e.code === 'Space' ? this.toggles.onParkingBrake : undefined;
    // Let Space/R reach focused buttons and fields (keyboard activation, typing).
    const target = e.target as HTMLElement | null;
    const interactive = target?.closest?.('button, input, select, textarea, a[href]');
    if (toggle && !interactive) {
      e.preventDefault();
      if (!e.repeat) toggle();
      return;
    }
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    this.keys.add(action);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const action = KEY_MAP[e.code];
    if (action) this.keys.delete(action);
  };
}
