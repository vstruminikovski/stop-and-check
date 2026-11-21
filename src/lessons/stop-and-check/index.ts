import type { LessonDefinition } from '../types';
import { CHECKLIST_KEYS, startStopAndCheck } from './session';

export const stopAndCheck: LessonDefinition = {
  id: 'stop-and-check',
  checklist: CHECKLIST_KEYS,
  copy: (dict) => dict.lessons['stop-and-check'],
  start: startStopAndCheck,
};
