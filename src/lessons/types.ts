import type { Dict } from '../i18n';

export interface LessonCopy {
  title: string;
  goal: string;
  briefing: string;
  checklist: Record<string, string>;
  retryGuidance: string;
}

export interface ChecklistOutcome {
  key: string;
  completed: boolean;
}

export interface LessonResult {
  items: ChecklistOutcome[];
}

export interface SessionHooks {
  onComplete(result: LessonResult): void;
  onHome(): void;
  onRetry(): void;
  /** The device cannot render the scene; the shell shows a fallback. */
  onUnsupported(): void;
}

export interface LessonSession {
  /** Re-read copy after a language change without restarting the scene. */
  relabel(): void;
  dispose(): void;
}

export interface LessonDefinition {
  id: string;
  /** Checklist keys in display order. */
  checklist: readonly string[];
  copy(dict: Dict): LessonCopy;
  start(host: HTMLElement, hooks: SessionHooks): LessonSession;
}
