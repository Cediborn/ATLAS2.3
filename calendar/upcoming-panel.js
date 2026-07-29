// Atlas Calendar — UpcomingEventsPanel. Reads through state.js's selectors
// only — no separate data path, so it can never show something the main
// calendar wouldn't (same filters/visibility apply here too).

import { icon } from '../icons.js';
import { EventCard, CalendarEmptyState } from './components.js';
import { getVisibleEventsInRange } from './state.js';
import { addDays, toLocalISODate } from '../date-utils.js';

function section(title, iconName, bodyHtml) {
  return `
    <div class="cal-upcoming__section">
      <h4 class="cal-upcoming__section-title">${icon(iconName, { size: 14 })}<span>${title}</span></h4>
      <div class="cal-upcoming__section-body">${bodyHtml}</div>
    </div>`;
}

export function renderUpcomingPanel({ collapsed }) {
  if (collapsed) {
    return `<button type="button" class="cal-upcoming__reopen" id="cal-upcoming-reopen" aria-label="Show upcoming panel">${icon('chevronLeft', { size: 16 })}</button>`;
  }

  const today = new Date();
  const todayISO = toLocalISODate(today);
  const tomorrowISO = toLocalISODate(addDays(today, 1));
  const weekEndISO = toLocalISODate(addDays(today, 7));

  const todayEvents = getVisibleEventsInRange(todayISO, todayISO).filter((e) => !e.deadline);
  const tomorrowEvents = getVisibleEventsInRange(tomorrowISO, tomorrowISO).filter((e) => !e.deadline);
  const weekEvents = getVisibleEventsInRange(todayISO, weekEndISO).filter(
    (e) => !e.deadline && (e.allDay ? e.start : e.start.slice(0, 10)) > tomorrowISO
  );
  const overdueDeadlines = getVisibleEventsInRange('2000-01-01', todayISO).filter(
    (e) => e.deadline && !e.completed && (e.allDay ? e.start : e.start.slice(0, 10)) <= todayISO
  );

  return `
    <div class="cal-upcoming">
      <div class="cal-upcoming__header">
        <h3>Upcoming</h3>
        <button type="button" class="icon-btn" id="cal-upcoming-collapse" aria-label="Collapse upcoming panel">${icon('chevronRight', { size: 16 })}</button>
      </div>
      <div class="cal-upcoming__scroll">
        ${section('Today', 'calendar', todayEvents.length ? todayEvents.map((e) => EventCard({ event: e })).join('') : CalendarEmptyState({ variant: 'noUpcoming' }))}
        ${section('Tomorrow', 'calendar', tomorrowEvents.length ? tomorrowEvents.map((e) => EventCard({ event: e })).join('') : CalendarEmptyState({ variant: 'noUpcoming' }))}
        ${section('Next 7 Days', 'layers', weekEvents.length ? weekEvents.map((e) => EventCard({ event: e })).join('') : CalendarEmptyState({ variant: 'noUpcoming' }))}
        ${section('Overdue Deadlines', 'alertTriangle', overdueDeadlines.length ? overdueDeadlines.map((e) => EventCard({ event: e })).join('') : CalendarEmptyState({ variant: 'noDeadlines' }))}
      </div>
    </div>`;
}
