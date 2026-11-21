/**
 * Local practice progress, kept in this browser only (same storage approach as
 * the language preference). "completed" means every checklist item was done in
 * at least one attempt; it is never downgraded by a later attempt.
 */
export type ProgressStatus = 'completed' | 'practice';

const STORAGE_KEY = 'progress';

function load(): Record<string, ProgressStatus> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (parsed && typeof parsed === 'object') return parsed as Record<string, ProgressStatus>;
  } catch {
    /* storage unavailable or corrupt */
  }
  return {};
}

export function getProgress(id: string): ProgressStatus | undefined {
  const value = load()[id];
  return value === 'completed' || value === 'practice' ? value : undefined;
}

export function recordAttempt(id: string, allCompleted: boolean): void {
  const all = load();
  if (all[id] === 'completed') return;
  all[id] = allCompleted ? 'completed' : 'practice';
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}
