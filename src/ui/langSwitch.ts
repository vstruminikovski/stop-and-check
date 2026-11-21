import { getLocale, LOCALES, setLocale } from '../i18n';
import { h } from './dom';

/** Segmented language control. The app re-renders copy via onLocaleChange. */
export function langSwitch(): HTMLElement {
  const group = h('div', { class: 'lang-switch', role: 'group' });
  for (const { code, label } of LOCALES) {
    const active = code === getLocale();
    group.append(
      h(
        'button',
        {
          type: 'button',
          lang: code,
          class: active ? 'is-active' : undefined,
          'aria-pressed': active ? 'true' : 'false',
          onclick: () => setLocale(code),
        },
        label,
      ),
    );
  }
  return group;
}
