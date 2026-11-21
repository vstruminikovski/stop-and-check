import { PRACTICE_EXERCISES } from './practice';
import { stopAndCheck } from './stop-and-check';
import type { LessonDefinition } from './types';

/** All playable lessons, in curriculum order. Add new lessons here. */
export const LESSONS: readonly LessonDefinition[] = [stopAndCheck];

/** Practice-area module: five exercises opened from their own screen. */
export const PRACTICE: readonly LessonDefinition[] = PRACTICE_EXERCISES;

export function findLesson(id: string): LessonDefinition | undefined {
  return [...LESSONS, ...PRACTICE].find((lesson) => lesson.id === id);
}
