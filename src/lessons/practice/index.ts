import type { LessonDefinition } from '../types';
import { EXERCISES } from './exercises';
import { startPractice } from './session';

export const PRACTICE_MODULE_ID = 'practice';

/** The practice-area exercises as lessons, so briefing/result screens are shared. */
export const PRACTICE_EXERCISES: readonly LessonDefinition[] = EXERCISES.map((spec) => ({
  id: spec.id,
  module: PRACTICE_MODULE_ID,
  checklist: spec.checklist,
  copy: (dict) => {
    const e = dict.exercises[spec.id];
    return { title: e.title, briefing: e.briefing, checklist: e.checklist };
  },
  start: (host, hooks) => startPractice(spec, host, hooks),
}));
