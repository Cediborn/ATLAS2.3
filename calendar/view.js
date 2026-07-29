// Atlas Calendar — Page controller. Same division of labor as
// projects/view.js and notes/view.js: every other file in this module is
// presentation or pure logic; this is the only one that touches the DOM.
// This file's renderCalendar() is the spec's "CalendarModule" root component.

import { icon } from '../icons.js';
import { CALENDARS, getCalendar, EVENT_TYPE_CONFIG } from './data.js';
import {
  getState, setState, getRangeForView, shiftSelectedDate, getVisibleEventsInRange,
  rescheduleEvent, toggleEventCompleted, addEvent, updateEvent, deleteEvent, deleteOccurrence,
} from './state.js';
import { CalendarSkeleton, EventTypeIcon, DeadlineBadge, RecurringBadge, eventTimeLabel, CalendarRow } from './components.js';
import { renderMonthView } from './month-view.js';
import { renderWeekView } from './week-view.js';
import { renderDayView } from './day-view.js';
import { renderAgendaView, initAgendaScrollGrowth } from './agenda-view.js';
import { renderMiniCalendar, shiftMiniCalendarMonth, syncMiniCalendarCursor } from './mini-calendar.js';
import { renderUpcomingPanel } from './upcoming-panel.js';
import {
  toolbarMarkup, updateToolbarLabel, setActiveViewButton, initFilterPopover, updateFilterCount, initCalendarSelector, initViewSwitcher,
} from './toolbar.js';
import { initEventDialog, openEventDialog, closeDialog } from './event-dialog.js';
import { initDragController } from './drag-controller.js';
import { snapPointerToSlot, HOUR_HEIGHT } from './time-grid.js';
import { formatDate, toLocalISODate } from '../date-utils.js';

let cleanupDrag = null;
let cleanupAgenda = null;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function renderCalendarSkeleton(container) {
  container.innerHTML = CalendarSkeleton();
}

export function renderCalendar(container) {
  container.innerHTML = `
    <div class="cal-page">
      <div id="cal-toolbar-mount"></div>
      <div class="cal-body" id="cal-body">
        <button type="button" class="cal-rail-toggle" id="cal-rail-toggle" aria-label="Show mini calendar">${icon('menu', { size: 18 })}</button>
        <div class="cal-rail-backdrop" id="cal-rail-backdrop"></div>
        <aside class="cal-rail cal-rail--left" id="cal-rail-left">
          <div id="cal-mini-mount"></div>
          <div class="cal-calendars-list" id="cal-calendars-list"></div>
        </aside>
        <div class="cal-main" id="cal-main" tabindex="-1"></div>
        <aside class="cal-rail cal-rail--right" id="cal-rail-right"></aside>
      </div>
    </div>
    <div class="cal-popover-mount" id="cal-popover-mount"></div>`;

  document.getElementById('cal-toolbar-mount').innerHTML = toolbarMarkup();

  initEventDialog(container, {
    onSave: (payload, mode) => {
      if (mode === 'create') addEvent(payload);
      else updateEvent(payload.id, payload);
      renderAll();
    },
    onDelete: (eventId) => {
      if (eventId.includes('::')) deleteOccurrence(eventId);
      else deleteEvent(eventId);
      renderAll();
    },
  });

  initToolbarInteractions();
  initMiniCalendarInteractions();
  initRailToggle();
  initUpcomingInteractions();
  initMainInteractions();
  initKeyboardNav();

  renderAll();
}

// ================= COMPOSITE RENDERS =================
// Split by what actually changed, so a prev/next click doesn't re-render
// the upcoming panel, and a filter change doesn't re-run recurrence
// expansion three separate times for three different call sites.

function renderMain() {
  const root = document.getElementById('cal-main');
  const { view, selectedDate } = getState();
  const { start, end } = getRangeForView(view, selectedDate);
  const events = getVisibleEventsInRange(start, end);

  cleanupDrag?.();
  cleanupAgenda?.();

  const html =
    view === 'month' ? renderMonthView({ selectedDate, events })
    : view === 'week' ? renderWeekView({ selectedDate, events })
    : view === 'day' ? renderDayView({ selectedDate, events })
    : renderAgendaView({ selectedDate });

  const apply = () => {
    root.innerHTML = html;
    root.dataset.view = view;
    wireMainViewBehavior(view);
  };

  if (!reduceMotion && document.startViewTransition) document.startViewTransition(apply);
  else apply();

  updateToolbarLabel();
  setActiveViewButton(view);
}

function renderMini() {
  document.getElementById('cal-mini-mount').innerHTML = renderMiniCalendar({ selectedDate: getState().selectedDate });
  document.getElementById('cal-calendars-list').innerHTML = `
    <h4 class="cal-rail__label">Calendars</h4>
    ${CALENDARS.map((c) => CalendarRow({ cal: c })).join('')}`;
}

function renderUpcoming() {
  document.getElementById('cal-rail-right').innerHTML = renderUpcomingPanel({ collapsed: getState().upcomingCollapsed });
  wireUpcomingReopenOrCollapse();
}

function renderAll() {
  renderMain();
  renderMini();
  renderUpcoming();
  updateFilterCount();
}

// ================= MAIN VIEW BEHAVIOR (event delegation + drag) =================

function wireMainViewBehavior(view) {
  const root = document.getElementById('cal-main');

  root.addEventListener('click', onMainClick);
  root.addEventListener('keydown', onMainKeydown);

  if (view === 'agenda') {
    cleanupAgenda = initAgendaScrollGrowth(root);
    return; // agenda has no drag-to-reschedule surface
  }

  cleanupDrag = initDragController({
    root,
    isDraggable: (eventId) => !eventId.startsWith('adapter:'),
    snap: (x, y) => {
      if (view === 'month') return snapToMonthCell(x, y);
      const grid = root.querySelector('.cal-timed-view');
      if (!grid) return null;
      const { selectedDate } = getState();
      const dates = view === 'day' ? [selectedDate] : weekDatesFrom(selectedDate);
      const dragged = currentDragDurationMs;
      return snapPointerToSlot(x, y, grid, dates, dragged);
    },
    onDragStart: (eventId) => { currentDragDurationMs = getDraggedDurationMs(eventId); },
    onDragMove: (eventId, target) => showDragPreview(target),
    onDrop: (eventId, start, end) => {
      hideDragPreview();
      if (!eventId || start === null) return; // cancelled
      const startISO = start instanceof Date ? formatDragTarget(start) : start;
      const endISO = end instanceof Date ? formatDragTarget(end) : end;
      rescheduleEvent(eventId, startISO, endISO);
      renderMain();
      renderMini();
    },
  });
}

let currentDragDurationMs = 60 * 60 * 1000;

function getDraggedDurationMs(eventId) {
  const { start, end } = getRangeForView(getState().view, getState().selectedDate);
  const ev = getVisibleEventsInRange(start, end).find((e) => e.id === eventId);
  if (!ev) return 60 * 60 * 1000;
  return new Date(ev.end) - new Date(ev.start) || 60 * 60 * 1000;
}

function formatDragTarget(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

function weekDatesFrom(selectedDate) {
  const { start } = getRangeForView('week', selectedDate);
  const startDate = new Date(`${start}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return toLocalISODate(d);
  });
}

function snapToMonthCell(x, y) {
  const cell = document.elementFromPoint(x, y)?.closest('.cal-month-cell');
  if (!cell) return null;
  const start = new Date(`${cell.dataset.date}T00:00:00`);
  const end = new Date(start.getTime() + currentDragDurationMs);
  return { start, end, label: cell.dataset.date };
}

function showDragPreview(target) {
  const root = document.getElementById('cal-main');
  root.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
  const dateKey = target.label?.split(' ')[0] || target.label;
  const el = root.querySelector(`[data-date="${dateKey}"]`);
  el?.classList.add('is-drop-target');
}
function hideDragPreview() {
  document.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
}

function onMainClick(e) {
  const overflowBtn = e.target.closest('.cal-overflow');
  if (overflowBtn) {
    setState({ selectedDate: overflowBtn.dataset.overflowDate, view: 'day' });
    renderAll();
    return;
  }

  const eventEl = e.target.closest('[data-cal-event]');
  if (eventEl) {
    openPopoverFor(eventEl.dataset.eventId, eventEl.getBoundingClientRect());
    return;
  }

  const cell = e.target.closest('.cal-month-cell, .cal-day-col, .cal-agenda-group__header');
  if (cell?.dataset.date) {
    setState({ selectedDate: cell.dataset.date, view: 'day' });
    renderAll();
  }
}

function onMainKeydown(e) {
  const focused = document.activeElement;
  const cell = focused?.closest?.('.cal-month-cell');
  if (!cell) return;

  const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
  if (deltas[e.key] != null) {
    e.preventDefault();
    const d = new Date(`${cell.dataset.date}T00:00:00`);
    d.setDate(d.getDate() + deltas[e.key]);
    const nextISO = toLocalISODate(d);
    const nextCell = document.querySelector(`.cal-month-cell[data-date="${nextISO}"]`);
    if (nextCell) { nextCell.focus(); setState({ selectedDate: nextISO }); }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    setState({ selectedDate: cell.dataset.date, view: 'day' });
    renderAll();
  }
}

// ================= POPOVER =================

function openPopoverFor(eventId, anchorRect) {
  const { start, end } = getRangeForView('agenda', getState().selectedDate);
  const ev = getVisibleEventsInRange(start, end).find((e) => e.id === eventId)
    || getVisibleEventsInRange('2000-01-01', '2100-01-01').find((e) => e.id === eventId);
  if (!ev) return;

  const mount = document.getElementById('cal-popover-mount');
  const cal = getCalendar(ev.calendarId);
  const color = ev.color || cal.color;

  mount.innerHTML = `
    <div class="cal-popover-backdrop" id="cal-popover-backdrop"></div>
    <div class="cal-popover cal-popover--${color}" role="dialog" aria-label="${ev.title}">
      <div class="cal-popover__top">
        <span class="cal-popover__type">${EventTypeIcon({ type: ev.type })}</span>
        <h3>${ev.title}</h3>
        <button type="button" class="icon-btn" id="cal-popover-close" aria-label="Close">${icon('x', { size: 16 })}</button>
      </div>
      <div class="cal-popover__meta">
        <span>${icon('clock', { size: 13 })}${eventTimeLabel(ev)}</span>
        ${ev.location ? `<span>${icon('mapPin', { size: 13 })}${ev.location}</span>` : ''}
      </div>
      ${ev.description ? `<p class="cal-popover__desc">${ev.description}</p>` : ''}
      <div class="cal-popover__badges">
        <span class="cal-row__dot cal-row__dot--${color}"></span><span class="cal-popover__cal-name">${cal.name}</span>
        ${ev.deadline ? DeadlineBadge({ event: ev }) : ''}
        ${ev.recurring || ev.isRecurrenceInstance ? RecurringBadge({ event: ev }) : ''}
      </div>
      <div class="cal-popover__actions">
        ${!ev.readOnly ? `<button type="button" class="btn btn--secondary" id="cal-popover-complete">${icon('check', { size: 14 })}<span>${ev.completed ? 'Mark incomplete' : 'Mark complete'}</span></button>` : ''}
        ${!ev.readOnly ? `<button type="button" class="btn btn--secondary" id="cal-popover-edit">${icon('fileText', { size: 14 })}<span>Edit</span></button>` : `<span class="cal-popover__readonly-note">Synced from Projects \u2014 edit it there.</span>`}
        ${!ev.readOnly ? `<button type="button" class="btn btn--secondary" id="cal-popover-delete">${icon('archive', { size: 14 })}<span>Delete</span></button>` : ''}
      </div>
    </div>`;

  positionPopover(mount.querySelector('.cal-popover'), anchorRect);

  mount.querySelector('#cal-popover-backdrop').addEventListener('click', closePopover);
  mount.querySelector('#cal-popover-close').addEventListener('click', closePopover);
  mount.querySelector('#cal-popover-complete')?.addEventListener('click', () => { toggleEventCompleted(ev.id); closePopover(); renderAll(); });
  mount.querySelector('#cal-popover-edit')?.addEventListener('click', () => { closePopover(); openEventDialog({ mode: 'edit', event: ev }); });
  mount.querySelector('#cal-popover-delete')?.addEventListener('click', () => {
    if (ev.isRecurrenceInstance) deleteOccurrence(ev.id); else deleteEvent(ev.id);
    closePopover();
    renderAll();
  });

  document.addEventListener('keydown', onPopoverEscape);
}

function onPopoverEscape(e) {
  if (e.key === 'Escape') closePopover();
}

function closePopover() {
  document.getElementById('cal-popover-mount').innerHTML = '';
  document.removeEventListener('keydown', onPopoverEscape);
}

function positionPopover(popoverEl, anchorRect) {
  const margin = 8;
  const rect = popoverEl.getBoundingClientRect();
  let top = anchorRect.bottom + margin;
  let left = anchorRect.left;

  if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, anchorRect.top - rect.height - margin);
  if (left + rect.width > window.innerWidth - margin) left = window.innerWidth - rect.width - margin;
  left = Math.max(margin, left);

  popoverEl.style.top = `${top}px`;
  popoverEl.style.left = `${left}px`;
}

// ================= TOOLBAR / MINI / UPCOMING WIRING =================

function initToolbarInteractions() {
  document.getElementById('cal-prev').addEventListener('click', () => {
    const { view, selectedDate } = getState();
    setState({ selectedDate: shiftSelectedDate(view, selectedDate, -1) });
    syncMiniCalendarCursor(getState().selectedDate);
    renderMain();
    renderMini();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    const { view, selectedDate } = getState();
    setState({ selectedDate: shiftSelectedDate(view, selectedDate, 1) });
    syncMiniCalendarCursor(getState().selectedDate);
    renderMain();
    renderMini();
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    setState({ selectedDate: toLocalISODate(new Date()) });
    syncMiniCalendarCursor(getState().selectedDate);
    renderMain();
    renderMini();
  });

  document.getElementById('cal-search').addEventListener('input', (e) => {
    setState({ search: e.target.value });
    renderAll();
  });

  document.getElementById('cal-create').addEventListener('click', () => {
    openEventDialog({ mode: 'create', seedDateISO: getState().selectedDate });
  });

  initViewSwitcher({
    onChangeView: (view) => {
      setState({ view });
      renderMain();
    },
  });

  initFilterPopover({ onChange: renderAll });
  initCalendarSelector({ onChange: renderAll });
}

function initMiniCalendarInteractions() {
  const mount = document.getElementById('cal-mini-mount');
  mount.addEventListener('click', (e) => {
    if (e.target.closest('#cal-mini-prev')) { shiftMiniCalendarMonth(-1); renderMini(); return; }
    if (e.target.closest('#cal-mini-next')) { shiftMiniCalendarMonth(1); renderMini(); return; }
    const cell = e.target.closest('[data-date]');
    if (cell) {
      setState({ selectedDate: cell.dataset.date });
      renderMain();
      renderMini();
      closeMobileRail();
    }
  });

  document.getElementById('cal-calendars-list').addEventListener('change', (e) => {
    const cb = e.target.closest('[data-calendar-id]');
    if (!cb) return;
    import('./state.js').then(({ toggleCalendarVisibility }) => {
      toggleCalendarVisibility(cb.dataset.calendarId);
      renderAll();
    });
  });
}

function initUpcomingInteractions() {
  // Re-attached after every renderUpcoming() call since innerHTML replaces the nodes.
}

function wireUpcomingReopenOrCollapse() {
  document.getElementById('cal-upcoming-collapse')?.addEventListener('click', () => {
    setState({ upcomingCollapsed: true });
    renderUpcoming();
  });
  document.getElementById('cal-upcoming-reopen')?.addEventListener('click', () => {
    setState({ upcomingCollapsed: false });
    renderUpcoming();
  });
  document.getElementById('cal-rail-right').addEventListener('click', (e) => {
    const card = e.target.closest('[data-cal-event]');
    if (card) openPopoverFor(card.dataset.eventId, card.getBoundingClientRect());
  });
}

function initMainInteractions() {
  // Delegation is (re)attached per-render inside wireMainViewBehavior since
  // renderMain() replaces #cal-main's innerHTML each time.
}

function initRailToggle() {
  const toggle = document.getElementById('cal-rail-toggle');
  const backdrop = document.getElementById('cal-rail-backdrop');
  toggle.addEventListener('click', () => {
    const open = !getState().leftRailOpen;
    setState({ leftRailOpen: open });
    document.getElementById('cal-rail-left').classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
  });
  backdrop.addEventListener('click', closeMobileRail);
}

function closeMobileRail() {
  setState({ leftRailOpen: false });
  document.getElementById('cal-rail-left')?.classList.remove('is-open');
  document.getElementById('cal-rail-backdrop')?.classList.remove('is-open');
}

function initKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    const overlayOpen = !document.getElementById('cal-dialog-overlay')?.hidden;
    if (overlayOpen) return; // the dialog owns Escape/Tab while it's open
    if (e.key === 'Escape') closePopover();
  });
}
