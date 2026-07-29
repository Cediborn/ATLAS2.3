// Atlas Calendar — Shared presentation components. Pure functions only, same
// rule as projects/components.js and notes/components.js: no DOM queries, no
// event listeners. Behavior is wired by the view files that use these.

import { icon } from '../icons.js';
import { emptyState, Tag } from '../components.js';
import { getCalendar, EVENT_TYPE_CONFIG } from './data.js';
import { describeRecurrence } from './recurrence.js';
import { daysUntil, formatDate, formatTime } from '../date-utils.js';

// ---- DeadlineBadge — countdown / overdue, independent of event type ----
export function DeadlineBadge({ event }) {
  const dateStr = event.allDay ? event.start : event.start.slice(0, 10);
  const days = daysUntil(dateStr);
  if (event.completed) return `<span class="cal-badge cal-badge--done">${icon('check', { size: 12 })}<span>Done</span></span>`;
  if (days < 0) return `<span class="cal-badge cal-badge--overdue">${icon('alertTriangle', { size: 12 })}<span>${Math.abs(days)}d overdue</span></span>`;
  if (days === 0) return `<span class="cal-badge cal-badge--due-today">${icon('alertTriangle', { size: 12 })}<span>Due today</span></span>`;
  return `<span class="cal-badge cal-badge--upcoming">${icon('alertTriangle', { size: 12 })}<span>Due in ${days}d</span></span>`;
}

// ---- RecurringBadge ----
export function RecurringBadge({ event, compact = false }) {
  const title = event.recurring ? describeRecurrence(event.recurrenceRule) : 'Repeats';
  return `<span class="cal-badge cal-badge--recurring" title="${title}">${icon('repeat', { size: compact ? 11 : 12 })}${compact ? '' : '<span>Repeats</span>'}</span>`;
}

// ---- EventTypeIcon ----
export function EventTypeIcon({ type, size = 13 }) {
  const cfg = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.normal;
  return icon(cfg.icon, { size });
}

// ---- Small time-range label, respecting allDay ----
export function eventTimeLabel(event) {
  if (event.allDay) return 'All day';
  const s = new Date(event.start);
  const e = new Date(event.end);
  return `${formatTime(s)} \u2013 ${formatTime(e)}`;
}

// ---- EventCard — used by Agenda, Upcoming panel, and the popover's list-y contexts ----
export function EventCard({ event: e, highlightQuery = '' }) {
  const cal = getCalendar(e.calendarId);
  const color = e.color || cal.color;
  const title = highlightQuery ? highlightMatch(e.title, highlightQuery) : e.title;
  return `
    <article class="cal-event-card cal-event-card--${color}" data-cal-event data-event-id="${e.id}" data-draggable="${!e.readOnly}" tabindex="0" role="button" aria-label="Open ${e.title}">
      <span class="cal-event-card__bar"></span>
      <div class="cal-event-card__body">
        <div class="cal-event-card__top">
          <span class="cal-event-card__type">${EventTypeIcon({ type: e.type })}</span>
          <h4 class="cal-event-card__title">${title}</h4>
          ${e.deadline ? DeadlineBadge({ event: e }) : ''}
          ${e.recurring || e.isRecurrenceInstance ? RecurringBadge({ event: e, compact: true }) : ''}
        </div>
        <div class="cal-event-card__meta">
          <span>${eventTimeLabel(e)}</span>
          ${e.location ? `<span class="cal-event-card__location">${icon('mapPin', { size: 12 })}${e.location}</span>` : ''}
        </div>
      </div>
    </article>`;
}

// ---- EventPill — the compact form used inside Month cells and time-grid slots ----
export function EventPill({ event: e, variant = 'month' }) {
  const cal = getCalendar(e.calendarId);
  const color = e.color || cal.color;
  const readOnlyAttr = e.readOnly ? ' data-readonly="true"' : '';
  return `
    <div class="cal-pill cal-pill--${variant} cal-pill--${color}${e.deadline ? ' cal-pill--deadline' : ''}" data-cal-event data-event-id="${e.id}" data-draggable="${!e.readOnly}"${readOnlyAttr} tabindex="0" role="button" aria-label="${e.title}, ${eventTimeLabel(e)}">
      ${variant === 'month' ? '' : '<span class="cal-pill__drag-handle">' + icon('gripVertical', { size: 12 }) + '</span>'}
      ${!e.allDay && variant === 'month' ? `<span class="cal-pill__dot"></span>` : ''}
      <span class="cal-pill__title">${e.title}</span>
      ${variant !== 'month' ? `<span class="cal-pill__time">${eventTimeLabel(e)}</span>` : ''}
      ${e.recurring || e.isRecurrenceInstance ? `<span class="cal-pill__icon">${icon('repeat', { size: 10 })}</span>` : ''}
    </div>`;
}

// ---- Overflow indicator ("+3 more") for Month cells ----
export function OverflowIndicator({ count, dateKey }) {
  return `<button type="button" class="cal-overflow" data-overflow-date="${dateKey}">+${count} more</button>`;
}

// ---- CalendarRow — one row inside CalendarSelector / the left-rail legend.
// Same markup either way; `interactive` only toggles whether it's a checkbox
// or a static dot, so the legend and the selector never drift apart.
export function CalendarRow({ cal, count = null, interactive = true }) {
  return `
    <label class="cal-row${interactive ? '' : ' cal-row--static'}">
      ${interactive
        ? `<input type="checkbox" data-calendar-id="${cal.id}" ${cal.visible ? 'checked' : ''} />`
        : `<span class="cal-row__dot cal-row__dot--${cal.color}" aria-hidden="true"></span>`}
      <span class="cal-row__dot cal-row__dot--${cal.color}" aria-hidden="true" ${interactive ? '' : 'hidden'}></span>
      <span class="cal-row__name">${cal.name}${cal.readOnly ? ' <span class="cal-row__readonly">(synced)</span>' : ''}</span>
      ${count !== null ? `<span class="cal-row__count">${count}</span>` : ''}
    </label>`;
}

// ---- CalendarLegend — read-only strip, e.g. atop Agenda/Month ----
export function CalendarLegend({ calendars }) {
  return `<div class="cal-legend">${calendars.filter((c) => c.visible).map((c) => `<span class="cal-legend__item"><span class="cal-row__dot cal-row__dot--${c.color}"></span>${c.name}</span>`).join('')}</div>`;
}

// ---- CurrentTimeIndicator — positioned by the caller (top offset via CSS var) ----
export function CurrentTimeIndicator({ topPx }) {
  return `<div class="cal-now-line" style="top:${topPx}px"><span class="cal-now-line__dot"></span></div>`;
}

// ---- Empty / loading states ----
export function CalendarEmptyState({ variant }) {
  const variants = {
    noEvents: { icon: 'calendar', title: 'Nothing scheduled', description: 'This day is wide open.' },
    noSearchResults: { icon: 'search', title: 'No events match', description: 'Try a different search term or clear your filters.' },
    noUpcoming: { icon: 'calendar', title: 'Nothing coming up', description: "You're all caught up for now." },
    noDeadlines: { icon: 'check', title: 'No deadlines due', description: 'Nothing overdue or approaching.' },
    noCalendars: { icon: 'layers', title: 'No calendars yet', description: 'Create one from the calendar selector.' },
  };
  const v = variants[variant] || variants.noEvents;
  return emptyState({ ...v, size: 'sm' });
}

export function CalendarSkeleton() {
  return `
    <div class="cal-skeleton" aria-hidden="true">
      <div class="cal-skeleton__toolbar skeleton-block"></div>
      <div class="cal-skeleton__body">
        <div class="skeleton-block" style="height:280px"></div>
        <div class="skeleton-block" style="height:520px"></div>
        <div class="skeleton-block" style="height:280px"></div>
      </div>
    </div>`;
}

// ---- Search-highlight helper, shared by Agenda/Upcoming/Search results ----
export function highlightMatch(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'ig'), '<mark>$1</mark>');
}
