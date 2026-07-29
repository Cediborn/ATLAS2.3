// Atlas Calendar — Shared time-grid engine.
// Week view and Day view are the same grid at different widths (7 columns vs
// 1), so the grid itself, the hour rows, the overlap-layout algorithm, and
// the current-time line all live here once. week-view.js/day-view.js are
// thin callers that just decide which dates to pass in.

import { icon } from '../icons.js';
import { getCalendar } from './data.js';
import { EventPill, CurrentTimeIndicator } from './components.js';
import { formatWeekdayShort, isSameDay, toLocalISODate } from '../date-utils.js';

export const HOUR_HEIGHT = 56; // px per hour row — the one layout constant this file owns
const START_HOUR = 0;
const END_HOUR = 24;

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Greedy column-packing overlap layout (the same approach real calendar
 * apps use): sort by start time, place each event in the first column whose
 * previous occupant already ended, opening a new column otherwise. Events in
 * the same connected cluster share that cluster's column count for width.
 */
export function layoutOverlaps(items) {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const layout = new Map();
  let cluster = [];
  let clusterEnd = -Infinity;

  function resolveCluster() {
    if (!cluster.length) return;
    const columnEnds = [];
    const assigned = [];
    for (const item of cluster) {
      let col = columnEnds.findIndex((end) => end <= item.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[col] = item.endMin;
      }
      assigned.push({ item, col });
    }
    const columnCount = columnEnds.length;
    for (const { item, col } of assigned) layout.set(item.id, { column: col, columnCount });
    cluster = [];
  }

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) resolveCluster();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  resolveCluster();
  return layout;
}

function renderHourLabels() {
  const rows = [];
  for (let h = START_HOUR; h < END_HOUR; h += 1) {
    const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    rows.push(`<div class="cal-time-col__row" style="height:${HOUR_HEIGHT}px">${h === START_HOUR ? '' : `<span>${label}</span>`}</div>`);
  }
  return rows.join('');
}

function renderDayColumn(dateISO, timedEvents, today) {
  const date = new Date(`${dateISO}T00:00:00`);
  const isToday = isSameDay(date, today);

  const items = timedEvents.map((e) => {
    const s = new Date(e.start);
    const en = new Date(e.end);
    const startMin = Math.max(0, minutesSinceMidnight(s));
    const endMin = Math.min(24 * 60, Math.max(startMin + 15, minutesSinceMidnight(en) || 24 * 60));
    return { id: e.id, event: e, startMin, endMin };
  });
  const layout = layoutOverlaps(items);

  const eventsHtml = items
    .map(({ id, event, startMin, endMin }) => {
      const pos = layout.get(id) || { column: 0, columnCount: 1 };
      const top = (startMin / 60) * HOUR_HEIGHT;
      const height = Math.max(18, ((endMin - startMin) / 60) * HOUR_HEIGHT);
      const width = 100 / pos.columnCount;
      const left = pos.column * width;
      return `<div class="cal-grid-event" style="top:${top}px;height:${height}px;left:${left}%;width:calc(${width}% - 4px)">${EventPill({ event, variant: 'grid' })}</div>`;
    })
    .join('');

  let nowLineHtml = '';
  if (isToday) {
    const now = new Date();
    const top = (minutesSinceMidnight(now) / 60) * HOUR_HEIGHT;
    nowLineHtml = CurrentTimeIndicator({ topPx: top });
  }

  return `
    <div class="cal-day-col${isToday ? ' is-today' : ''}" data-date="${dateISO}" style="height:${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px">
      ${Array.from({ length: END_HOUR - START_HOUR }, (_, i) => `<div class="cal-day-col__hour-line" style="top:${i * HOUR_HEIGHT}px"></div>`).join('')}
      ${eventsHtml}
      ${nowLineHtml}
    </div>`;
}

function renderAllDayRow(dates, allDayEvents) {
  return dates
    .map((dateISO) => {
      const dayEvents = allDayEvents.filter((e) => e.start <= dateISO && e.end >= dateISO);
      return `<div class="cal-all-day-col" data-date="${dateISO}">${dayEvents.map((e) => EventPill({ event: e, variant: 'allday' })).join('')}</div>`;
    })
    .join('');
}

/**
 * Renders the full grid markup for an arbitrary list of dates (7 for Week, 1
 * for Day). Header row, sticky all-day row, scrollable hour grid.
 */
export function renderTimeGrid({ dates, events, showWeekdayHeader = true }) {
  const today = new Date();
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);

  const header = showWeekdayHeader
    ? `<div class="cal-grid-header">
        <div class="cal-grid-header__spacer"></div>
        ${dates
          .map((dateISO) => {
            const d = new Date(`${dateISO}T00:00:00`);
            const isToday = isSameDay(d, today);
            return `<div class="cal-grid-header__col${isToday ? ' is-today' : ''}">
              <span class="cal-grid-header__weekday">${formatWeekdayShort(d)}</span>
              <span class="cal-grid-header__date">${d.getDate()}</span>
            </div>`;
          })
          .join('')}
      </div>`
    : '';

  const allDayRow = allDay.length
    ? `<div class="cal-all-day-row">
        <div class="cal-all-day-row__label">All day</div>
        <div class="cal-all-day-row__grid" style="grid-template-columns:repeat(${dates.length},1fr)">${renderAllDayRow(dates, allDay)}</div>
      </div>`
    : '';

  const grid = `
    <div class="cal-time-grid">
      <div class="cal-time-col">${renderHourLabels()}</div>
      <div class="cal-time-grid__days" style="grid-template-columns:repeat(${dates.length},1fr)">
        ${dates.map((dateISO) => renderDayColumn(dateISO, timed.filter((e) => toLocalISODate(new Date(e.start)) === dateISO), today)).join('')}
      </div>
    </div>`;

  return `<div class="cal-timed-view">${header}${allDayRow}<div class="cal-timed-view__scroll">${grid}</div></div>`;
}

/** Converts a pointer position over the grid into a snapped {start,end} — used by drag-controller.js. */
export function snapPointerToSlot(clientX, clientY, gridEl, dates, durationMs, snapMinutes = 15) {
  const dayColumns = Array.from(gridEl.querySelectorAll('.cal-day-col'));
  if (!dayColumns.length) return null;

  const colWidth = dayColumns[0].getBoundingClientRect().width;
  const gridRect = gridEl.querySelector('.cal-time-grid__days')?.getBoundingClientRect();
  if (!gridRect) return null;

  let colIndex = Math.floor((clientX - gridRect.left) / colWidth);
  colIndex = Math.max(0, Math.min(dates.length - 1, colIndex));
  const dateISO = dates[colIndex];

  const colRect = dayColumns[colIndex].getBoundingClientRect();
  const offsetY = Math.max(0, clientY - colRect.top);
  const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
  const snapped = Math.round(rawMinutes / snapMinutes) * snapMinutes;
  const clamped = Math.max(0, Math.min(24 * 60 - 5, snapped));

  const start = new Date(`${dateISO}T00:00:00`);
  start.setMinutes(clamped);
  const end = new Date(start.getTime() + durationMs);

  return { start, end, label: `${dateISO} \u00b7 ${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` };
}
