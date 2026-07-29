// Atlas Calendar — Agenda view. "Infinite scroll" here means something real:
// a bounded window of dates is rendered at a time, and IntersectionObserver
// sentinels at the top/bottom grow the window in both directions as the
// person scrolls — without ever asking state.js to compute or the DOM to
// hold thousands of date groups at once. This is the closest a static,
// library-free page gets to real virtualization.

import { EventCard, CalendarEmptyState } from './components.js';
import { getVisibleEventsInRange } from './state.js';
import { addDays, toLocalISODate, formatFullDate } from '../date-utils.js';

const WINDOW_GROW_DAYS = 21;
const MAX_RENDERED_DAYS = 90; // trims the far edge once the window grows past this, capping DOM size

let windowStart = null;
let windowEnd = null;
let onGrow = null;

function groupByDate(events) {
  const map = new Map();
  for (const e of events) {
    const key = e.allDay ? e.start : e.start.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }
  return map;
}

function renderGroup(dateISO, dayEvents) {
  const date = new Date(`${dateISO}T00:00:00`);
  return `
    <section class="cal-agenda-group" data-date="${dateISO}">
      <header class="cal-agenda-group__header">
        <span class="cal-agenda-group__day">${date.getDate()}</span>
        <span class="cal-agenda-group__label">${formatFullDate(date)}</span>
      </header>
      <div class="cal-agenda-group__events">
        ${dayEvents.map((e) => EventCard({ event: e })).join('')}
      </div>
    </section>`;
}

export function renderAgendaView({ selectedDate }) {
  windowStart = addDays(new Date(`${selectedDate}T00:00:00`), -7);
  windowEnd = addDays(new Date(`${selectedDate}T00:00:00`), 21);

  const events = getVisibleEventsInRange(toLocalISODate(windowStart), toLocalISODate(windowEnd));
  const groups = groupByDate(events);
  const dateKeys = [...groups.keys()].sort();

  const body = dateKeys.length
    ? dateKeys.map((k) => renderGroup(k, groups.get(k))).join('')
    : `<div class="cal-agenda-empty">${CalendarEmptyState({ variant: 'noEvents' })}</div>`;

  return `
    <div class="cal-agenda-view">
      <div class="cal-agenda-sentinel" data-sentinel="top"></div>
      <div class="cal-agenda-list" id="cal-agenda-list">${body}</div>
      <div class="cal-agenda-sentinel" data-sentinel="bottom"></div>
    </div>`;
}

/** Grows the rendered window and re-renders just the list — called from view.js's IntersectionObserver. */
function growWindow(direction, listEl) {
  if (direction === 'bottom') windowEnd = addDays(windowEnd, WINDOW_GROW_DAYS);
  else windowStart = addDays(windowStart, -WINDOW_GROW_DAYS);

  // Cap total span so the DOM never holds more than MAX_RENDERED_DAYS worth of groups.
  const totalDays = Math.round((windowEnd - windowStart) / 86400000);
  if (totalDays > MAX_RENDERED_DAYS) {
    if (direction === 'bottom') windowStart = addDays(windowEnd, -MAX_RENDERED_DAYS);
    else windowEnd = addDays(windowStart, MAX_RENDERED_DAYS);
  }

  const events = getVisibleEventsInRange(toLocalISODate(windowStart), toLocalISODate(windowEnd));
  const groups = groupByDate(events);
  const dateKeys = [...groups.keys()].sort();
  listEl.innerHTML = dateKeys.length
    ? dateKeys.map((k) => renderGroup(k, groups.get(k))).join('')
    : `<div class="cal-agenda-empty">${CalendarEmptyState({ variant: 'noEvents' })}</div>`;
}

/** Wires the two sentinels to grow the window. Call once per Agenda render; returns a disconnect fn. */
export function initAgendaScrollGrowth(root) {
  const listEl = root.querySelector('#cal-agenda-list');
  if (!listEl) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        growWindow(entry.target.dataset.sentinel, listEl);
      }
    },
    { root: root.querySelector('.cal-agenda-view')?.closest('.cal-main') || null, rootMargin: '200px' }
  );

  root.querySelectorAll('[data-sentinel]').forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}
