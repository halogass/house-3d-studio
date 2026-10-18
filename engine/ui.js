// Page chrome that depends on the house and the language: the level buttons (dollhouse cut,
// minimap), the lift buttons, the title, the language picker, and the parts of the menu that a
// project can switch off (features in project.json).
import { PROJECT, FEATURES } from './data.js';
import { LEVELS, LEVEL_ORDER, LIFT, LIFT_STOPS, GROUND } from './config.js';
import { t, tr, applyI18n, getLang, setLang, LANGS } from './i18n.js';

const $ = (id) => document.getElementById(id);

export function buildUI() {
  applyI18n(document);
  const title = tr(PROJECT.title);
  document.title = title + ' · 3D';
  $('titleText').textContent = title;
  const desc = [...LEVEL_ORDER].reverse();
  // dollhouse cut: All + every level (top first)
  $('cut').innerHTML = `<button data-cut="all" class="on">${t('all')}</button>` + desc.map(l => `<button data-cut="${l}">${LEVELS[l].short}</button>`).join('');
  // minimap level picker
  $('mmLevels').innerHTML = desc.map(l => `<button data-lv="${l}"${l === GROUND ? ' class="on"' : ''}>${LEVELS[l].short}</button>`).join('');
  // lift floor buttons (bottom = 1)
  if (LIFT && LIFT_STOPS.length >= 2) {
    $('liftFloors').innerHTML = `<span>${t('liftPress', { n: LIFT_STOPS.length })}</span>` +
      LIFT_STOPS.map((l, i) => `<button data-lv="${l}">${i + 1} · ${LEVELS[l].short}</button>`).join('');
  } // else #liftUI stays hidden: nobody is ever inside a lift car
  // language
  const sel = $('lang');
  for (const l of LANGS) sel.add(new Option(l === 'id' ? 'Bahasa Indonesia' : 'English', l));
  sel.value = getLang();
  sel.onchange = () => { setLang(sel.value); location.reload(); };
  $('builtFrom').innerHTML = t('builtFrom', { name: PROJECT.name });
  // features that can be switched off
  if (FEATURES.multiplayer === false) $('mp').style.display = 'none';
  if (FEATURES.spec === false) $('menuTabs').style.display = 'none';
  if (FEATURES.cost === false) $('costLink').remove();
}
