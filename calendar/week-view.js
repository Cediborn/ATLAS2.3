// Atlas Calendar — Week view. Deliberately thin: all real grid logic (hour
// rows, overlap layout, current-time line) lives in time-grid.js so Week and
// Day never duplicate it.

import { getRangeForView } from './state.js';
import { renderTimeGrid } from './time-grid.js';
import { addDays } from '../date-utils.js';

export function renderWeekView({ selectedDate, events }) {
  const { start } = getRangeForView('week', selectedDate);
  const startDate = new Date(`${start}T00:00:00`);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startDate, i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  return `<div class="cal-week-view">${renderTimeGrid({ dates, events, showWeekdayHeader: true })}</div>`;
}
