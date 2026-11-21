import { stopAndCheck } from './stop-and-check';
import type { LessonDefinition } from './types';

/** All playable lessons, in curriculum order. Add new lessons here. */
export const LESSONS: readonly LessonDefinition[] = [stopAndCheck];

export function findLesson(id: string): LessonDefinition | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
