// Atlas Calendar — Day view. Same shared grid as Week, just one column —
// so a single-day schedule never drifts out of sync with the week grid's
// overlap handling, current-time line, or drag behavior.

import { renderTimeGrid } from './time-grid.js';
import { formatFullDate } from '../date-utils.js';

export function renderDayView({ selectedDate, events }) {
  const label = formatFullDate(new Date(`${selectedDate}T00:00:00`));
  return `
    <div class="cal-day-view">
      <h3 class="cal-day-view__heading">${label}</h3>
      ${renderTimeGrid({ dates: [selectedDate], events, showWeekdayHeader: false })}
    </div>`;
}
