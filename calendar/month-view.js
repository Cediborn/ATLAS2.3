// Atlas Calendar — Month view. The most traditional of the four; the
// interesting logic (recurrence, filtering) all happened upstream in
// state.js by the time this file sees `events` — this just lays them into
// a 6-week grid.

import { EventPill, OverflowIndicator } from './components.js';
import { getRangeForView } from './state.js';
import { toLocalISODate, isSameDay } from '../date-utils.js';

const MAX_VISIBLE_PER_CELL = 3;

function MonthCell({ dateISO, inFocusMonth, isToday, isWeekend, dayEvents }) {
  const date = new Date(`${dateISO}T00:00:00`);
  const visible = dayEvents.slice(0, MAX_VISIBLE_PER_CELL);
  const overflow = dayEvents.length - visible.length;

  return `
    <div class="cal-month-cell${inFocusMonth ? '' : ' is-outside'}${isToday ? ' is-today' : ''}${isWeekend ? ' is-weekend' : ''}"
         data-date="${dateISO}" tabindex="0" role="gridcell" aria-label="${date.toDateString()}${dayEvents.length ? `, ${dayEvents.length} events` : ''}">
      <div class="cal-month-cell__top">
        <span class="cal-month-cell__num">${date.getDate()}</span>
      </div>
      <div class="cal-month-cell__events">
        ${visible.map((e) => EventPill({ event: e, variant: 'month' })).join('')}
        ${overflow > 0 ? OverflowIndicator({ count: overflow, dateKey: dateISO }) : ''}
      </div>
    </div>`;
}

export function renderMonthView({ selectedDate, events }) {
  const { start, end } = getRangeForView('month', selectedDate);
  const focusMonth = new Date(`${selectedDate}T00:00:00`).getMonth();
  const gridStart = new Date(`${start}T00:00:00`);
  const gridEnd = new Date(`${end}T00:00:00`);
  const today = new Date();

  const weeks = [];
  let cursor = new Date(gridStart);
  let week = [];
  while (cursor <= gridEnd) {
    const dateISO = toLocalISODate(cursor);
    const dayEvents = events.filter((e) => {
      const s = e.allDay ? e.start : e.start.slice(0, 10);
      const en = e.allDay ? e.end : e.end.slice(0, 10);
      return s <= dateISO && en >= dateISO;
    });
    week.push({
      dateISO,
      inFocusMonth: cursor.getMonth() === focusMonth,
      isToday: isSameDay(cursor, today),
      isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
      dayEvents,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return `
    <div class="cal-month-view">
      <div class="cal-month-view__weekdays">
        ${weekdayLabels.map((w) => `<span>${w}</span>`).join('')}
      </div>
      <div class="cal-month-view__grid" role="grid">
        ${weeks.map((w) => w.map((cell) => MonthCell(cell)).join('')).join('')}
      </div>
    </div>`;
}
