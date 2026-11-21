import en from './locales/en.json';
import mk from './locales/mk.json';
import sq from './locales/sq.json';

export type Dict = typeof en;
export type Locale = 'mk' | 'sq' | 'en';

/** Selector order and short codes shown in the language switcher. */
export const LOCALES: readonly { code: Locale; label: string }[] = [
  { code: 'mk', label: 'MK' },
  { code: 'sq', label: 'SQ' },
  { code: 'en', label: 'EN' },
];

const dicts: Record<Locale, Dict> = { mk, sq, en };
const STORAGE_KEY = 'locale';
const listeners = new Set<() => void>();

function isLocale(value: unknown): value is Locale {
  return value === 'mk' || value === 'sq' || value === 'en';
}

function loadLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return 'mk';
}

let current: Locale = loadLocale();
document.documentElement.lang = current;

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  document.documentElement.lang = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
}

export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Current dictionary. Call at render time, never cache across locale changes. */
export function t(): Dict {
  return dicts[current];
}
