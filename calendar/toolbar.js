// Atlas Calendar — Toolbar. One component owning every top-level control;
// FilterMenu and CalendarSelector are implemented inline here (as
// notes/view.js already does for its own filter popover) rather than as
// separate files, since neither has meaning outside the toolbar that hosts it.

import { icon } from '../icons.js';
import { createPopover } from '../popover.js';
import { CALENDARS, PRIORITIES, EVENT_TYPES, EVENT_TYPE_CONFIG } from './data.js';
import { CalendarRow } from './components.js';
import { getState, setState, resetFilters, toggleCalendarVisibility, hasActiveFilters, getVisibleEventsInRange, getRangeForView } from './state.js';
import { formatMonthYear, formatFullDate } from '../date-utils.js';

const VIEW_OPTIONS = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
  { id: 'agenda', label: 'Agenda' },
];

export function toolbarMarkup() {
  return `
    <div class="cal-toolbar">
      <div class="cal-toolbar__nav">
        <button type="button" class="icon-btn" id="cal-prev" aria-label="Previous">${icon('chevronLeft', { size: 18 })}</button>
        <button type="button" class="icon-btn" id="cal-next" aria-label="Next">${icon('chevronRight', { size: 18 })}</button>
        <button type="button" class="btn btn--secondary" id="cal-today">Today</button>
        <h2 class="cal-toolbar__label" id="cal-toolbar-label" aria-live="polite"></h2>
      </div>

      <div class="cal-toolbar__center">
        <label class="toolbar-search" for="cal-search">
          ${icon('search', { size: 15 })}
          <input type="text" id="cal-search" placeholder="Search events\u2026" autocomplete="off" />
        </label>
      </div>

      <div class="cal-toolbar__right">
        <div class="toolbar-popover">
          <button type="button" class="btn btn--secondary" id="cal-filter-trigger">${icon('filter', { size: 15 })}<span>Filter</span><span class="badge badge--accent" id="cal-filter-count" hidden></span></button>
          <div class="menu projects-filter-panel" id="cal-filter-panel" hidden></div>
        </div>

        <div class="toolbar-popover">
          <button type="button" class="btn btn--secondary" id="cal-selector-trigger">${icon('layers', { size: 15 })}<span>Calendars</span></button>
          <div class="menu" id="cal-selector-panel" hidden></div>
        </div>

        <div class="view-switcher" role="tablist" aria-label="Calendar view" id="cal-view-switcher">
          ${VIEW_OPTIONS.map((v) => `<button type="button" class="view-switcher__option${v.id === 'month' ? ' is-active' : ''}" data-cal-view="${v.id}" role="tab" aria-selected="${v.id === 'month'}">${v.label}</button>`).join('')}
        </div>

        <button type="button" class="btn btn--primary" id="cal-create">${icon('plus', { size: 16 })}<span>Create Event</span></button>
      </div>
    </div>`;
}

export function updateToolbarLabel() {
  const { selectedDate, view } = getState();
  const d = new Date(`${selectedDate}T00:00:00`);
  const label = document.getElementById('cal-toolbar-label');
  if (!label) return;
  if (view === 'day') label.textContent = formatFullDate(d);
  else if (view === 'week') {
    const { start, end } = getRangeForView('week', selectedDate);
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    label.textContent = s.getMonth() === e.getMonth()
      ? `${formatMonthYear(s).split(' ')[0]} ${s.getDate()}\u2013${e.getDate()}, ${s.getFullYear()}`
      : `${formatMonthYear(s)} \u2013 ${formatMonthYear(e)}`;
  } else {
    label.textContent = formatMonthYear(d);
  }
}

export function setActiveViewButton(view) {
  document.querySelectorAll('[data-cal-view]').forEach((btn) => {
    const active = btn.dataset.calView === view;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
}

function filterCheckbox(type, value, checked, label) {
  return `
    <label class="menu__item filter-checkbox">
      <input type="checkbox" data-cal-filter-type="${type}" value="${value || ''}" ${checked ? 'checked' : ''} />
      <span>${label || value}</span>
    </label>`;
}

function toggleSetFilter(key, value, checked) {
  const current = new Set(getState().filters[key]);
  if (checked) current.add(value);
  else current.delete(value);
  setState({ filters: { ...getState().filters, [key]: current } });
}

export function initFilterPopover({ onChange }) {
  const trigger = document.getElementById('cal-filter-trigger');
  const panel = document.getElementById('cal-filter-panel');

  function render() {
    const f = getState().filters;
    panel.innerHTML = `
      <div class="menu__label">Timeframe</div>
      ${['today', 'week', 'month'].map((tf) => filterCheckbox('timeframe', tf, f.timeframe === tf, tf === 'today' ? 'Today' : tf === 'week' ? 'This week' : 'This month')).join('')}
      <div class="menu__divider"></div>
      <div class="menu__label">Calendar</div>
      ${CALENDARS.map((c) => filterCheckbox('calendarIds', c.id, f.calendarIds.has(c.id), c.name)).join('')}
      <div class="menu__divider"></div>
      <div class="menu__label">Priority</div>
      ${PRIORITIES.map((p) => filterCheckbox('priorities', p, f.priorities.has(p), p[0].toUpperCase() + p.slice(1))).join('')}
      <div class="menu__divider"></div>
      <div class="menu__label">Type</div>
      ${EVENT_TYPES.map((t) => filterCheckbox('types', t, f.types.has(t), EVENT_TYPE_CONFIG[t].label)).join('')}
      <div class="menu__divider"></div>
      ${filterCheckbox('completed', '', f.completed === true, 'Completed')}
      ${filterCheckbox('incomplete', '', f.completed === false, 'Incomplete')}
      ${filterCheckbox('hasReminder', '', f.hasReminder, 'Has reminder')}
      ${filterCheckbox('recurringOnly', '', f.recurringOnly, 'Recurring')}
      ${filterCheckbox('allDayOnly', '', f.allDayOnly, 'All day')}
      <div class="menu__divider"></div>
      <button type="button" class="menu__item" id="cal-filter-clear">${icon('x', { size: 16 })}<span>Clear filters</span></button>
    `;
  }

  createPopover({ trigger, panel, onOpenRender: render });

  panel.addEventListener('change', (e) => {
    const cb = e.target;
    const type = cb.dataset.calFilterType;
    if (type === 'timeframe') setState({ filters: { ...getState().filters, timeframe: cb.checked ? cb.value : null } });
    else if (type === 'calendarIds') toggleSetFilter('calendarIds', cb.value, cb.checked);
    else if (type === 'priorities') toggleSetFilter('priorities', cb.value, cb.checked);
    else if (type === 'types') toggleSetFilter('types', cb.value, cb.checked);
    else if (type === 'completed') setState({ filters: { ...getState().filters, completed: cb.checked ? true : null } });
    else if (type === 'incomplete') setState({ filters: { ...getState().filters, completed: cb.checked ? false : null } });
    else if (type === 'hasReminder') setState({ filters: { ...getState().filters, hasReminder: cb.checked } });
    else if (type === 'recurringOnly') setState({ filters: { ...getState().filters, recurringOnly: cb.checked } });
    else if (type === 'allDayOnly') setState({ filters: { ...getState().filters, allDayOnly: cb.checked } });
    updateFilterCount();
    onChange?.();
  });

  panel.addEventListener('click', (e) => {
    if (e.target.closest('#cal-filter-clear')) {
      resetFilters();
      render();
      updateFilterCount();
      onChange?.();
    }
  });
}

export function updateFilterCount() {
  const badge = document.getElementById('cal-filter-count');
  if (!badge) return;
  const active = hasActiveFilters();
  badge.hidden = !active;
  if (active) badge.textContent = '\u2022';
}

export function initCalendarSelector({ onChange }) {
  const trigger = document.getElementById('cal-selector-trigger');
  const panel = document.getElementById('cal-selector-panel');

  function countFor(calId) {
    const { start, end } = getRangeForView('agenda', getState().selectedDate);
    return getVisibleEventsInRange(start, end).filter((e) => e.calendarId === calId).length;
  }

  function render() {
    panel.innerHTML = `
      <div class="menu__label">Calendars</div>
      ${CALENDARS.map((c) => CalendarRow({ cal: c, count: countFor(c.id) })).join('')}
    `;
  }

  createPopover({ trigger, panel, onOpenRender: render });

  panel.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-calendar-id]');
    if (!cb) return;
    toggleCalendarVisibility(cb.dataset.calendarId);
    onChange?.();
  });
}

export function initViewSwitcher({ onChangeView }) {
  document.getElementById('cal-view-switcher').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cal-view]');
    if (btn) onChangeView(btn.dataset.calView);
  });
}
