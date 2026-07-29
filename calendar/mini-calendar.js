// Atlas Calendar — MiniCalendar. Its own month cursor (independent of the
// main view's selected date) so browsing months here doesn't yank the main
// calendar around — only clicking a specific day does that.

import { icon } from '../icons.js';
import { getVisibleEventsInRange } from './state.js';
import { getCalendar } from './data.js';
import { toLocalISODate, startOfWeek, startOfMonth, addDays, isSameDay, formatMonthYear } from '../date-utils.js';

let cursorMonth = null; // Date, always day=1 — independently browsable

export function renderMiniCalendar({ selectedDate }) {
  if (!cursorMonth) cursorMonth = startOfMonth(new Date(`${selectedDate}T00:00:00`));

  const monthStart = startOfMonth(cursorMonth);
  const monthEnd = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 0);
  const gridStart = startOfWeek(monthStart, 0);
  const gridEnd = addDays(startOfWeek(monthEnd, 0), 6);

  const rangeStartISO = toLocalISODate(gridStart);
  const rangeEndISO = toLocalISODate(gridEnd);
  const events = getVisibleEventsInRange(rangeStartISO, rangeEndISO);

  const today = new Date();
  const selected = new Date(`${selectedDate}T00:00:00`);

  const cells = [];
  let cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const dateISO = toLocalISODate(cursor);
    const dayEvents = events.filter((e) => {
      const s = e.allDay ? e.start : e.start.slice(0, 10);
      const en = e.allDay ? e.end : e.end.slice(0, 10);
      return s <= dateISO && en >= dateISO;
    });
    const dotColors = [...new Set(dayEvents.map((e) => e.color || getCalendar(e.calendarId).color))].slice(0, 3);

    cells.push(`
      <button type="button" class="cal-mini__cell${cursor.getMonth() !== cursorMonth.getMonth() ? ' is-outside' : ''}${isSameDay(cursor, today) ? ' is-today' : ''}${isSameDay(cursor, selected) ? ' is-selected' : ''}"
              data-date="${dateISO}" aria-label="${cursor.toDateString()}" aria-pressed="${isSameDay(cursor, selected)}">
        <span class="cal-mini__num">${cursor.getDate()}</span>
        ${dotColors.length ? `<span class="cal-mini__dots">${dotColors.map((c) => `<span class="cal-mini__dot cal-mini__dot--${c}"></span>`).join('')}</span>` : ''}
      </button>`);
    cursor = addDays(cursor, 1);
  }

  return `
    <div class="cal-mini">
      <div class="cal-mini__header">
        <span class="cal-mini__month">${formatMonthYear(cursorMonth)}</span>
        <div class="cal-mini__nav">
          <button type="button" class="icon-btn" id="cal-mini-prev" aria-label="Previous month">${icon('chevronLeft', { size: 16 })}</button>
          <button type="button" class="icon-btn" id="cal-mini-next" aria-label="Next month">${icon('chevronRight', { size: 16 })}</button>
        </div>
      </div>
      <div class="cal-mini__weekdays">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-mini__grid">${cells.join('')}</div>
    </div>`;
}

export function shiftMiniCalendarMonth(direction) {
  const next = new Date(cursorMonth);
  next.setMonth(next.getMonth() + direction);
  cursorMonth = next;
}

export function syncMiniCalendarCursor(selectedDateISO) {
  cursorMonth = startOfMonth(new Date(`${selectedDateISO}T00:00:00`));
}
