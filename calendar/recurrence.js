// Atlas Calendar — Recurrence engine.
// A deliberately small RRULE-lite implementation covering the patterns a
// personal calendar actually needs (daily / weekdays / weekly / biweekly /
// monthly / yearly / custom), rather than a full RFC 5545 parser. Every date
// here is built from local-time components — never `toISOString()`, which
// renders in UTC and can silently shift the day — so recurrence math never
// drifts across timezones.

import { toLocalISODate, toLocalISODateTime } from '../date-utils.js';

const HARD_CAP = 800; // safety valve against a malformed rule looping forever

function parseStart(event) {
  return event.allDay ? new Date(`${event.start}T00:00:00`) : new Date(event.start);
}
function parseEnd(event) {
  return event.allDay ? new Date(`${event.end}T00:00:00`) : new Date(event.end);
}

// Steps `date` forward by one occurrence of `rule`. Handles the two real
// calendar-math edge cases: monthly/yearly stepping off the end of a month
// (Jan 31 -> Feb) and yearly stepping off Feb 29 in a non-leap year — both
// clamp to the last valid day of the intended month instead of overflowing
// into the following month, which is what every mainstream calendar app does.
function stepDate(date, rule) {
  const interval = Math.max(1, rule.interval || 1);
  const next = new Date(date);

  switch (rule.freq) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      return next;
    case 'weekdays': {
      do next.setDate(next.getDate() + 1);
      while (next.getDay() === 0 || next.getDay() === 6);
      return next;
    }
    case 'weekly':
      next.setDate(next.getDate() + 7 * interval);
      return next;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      return next;
    case 'monthly':
      return stepMonths(next, interval);
    case 'yearly':
      return stepYears(next, interval);
    case 'custom': {
      const unit = rule.unit || 'week';
      if (unit === 'day') next.setDate(next.getDate() + interval);
      else if (unit === 'week') next.setDate(next.getDate() + 7 * interval);
      else if (unit === 'month') return stepMonths(next, interval);
      else if (unit === 'year') return stepYears(next, interval);
      return next;
    }
    default:
      return next;
  }
}

function stepMonths(date, interval) {
  const day = date.getDate();
  const next = new Date(date);
  next.setDate(1); // park on the 1st so setMonth can't overflow into the wrong month
  next.setMonth(next.getMonth() + interval);
  const daysInTarget = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, daysInTarget));
  return next;
}

function stepYears(date, interval) {
  const month = date.getMonth();
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + interval);
  if (next.getMonth() !== month) next.setDate(0); // Feb 29 -> Feb 28 in a non-leap target year
  return next;
}

function withinBounds(occurrenceDate, rule, index) {
  if (rule.count != null && index >= rule.count) return false;
  if (rule.until) {
    const until = new Date(`${rule.until}T23:59:59`);
    if (occurrenceDate > until) return false;
  }
  return true;
}

/**
 * Returns every occurrence start Date of `rule` (seeded at `seedStart`) that
 * falls within [rangeStart, rangeEnd]. Pure — no event object involved yet.
 */
export function generateOccurrenceDates(rule, seedStart, rangeStart, rangeEnd) {
  const dates = [];
  let cursor = new Date(seedStart);
  let index = 0;
  let safety = 0;

  while (cursor <= rangeEnd && safety < HARD_CAP) {
    safety += 1;
    if (!withinBounds(cursor, rule, index)) break;
    if (cursor >= rangeStart) dates.push(new Date(cursor));
    cursor = stepDate(cursor, rule);
    index += 1;
  }
  return dates;
}

/**
 * Expands a single event into its concrete occurrences within a range.
 * Non-recurring events just pass through if they overlap the range.
 * Recurring events are cloned per occurrence, with per-date `exceptions`
 * (set by dragging or deleting a single instance) applied on top.
 */
export function expandRecurrence(event, rangeStartISO, rangeEndISO) {
  const rangeStart = new Date(`${rangeStartISO}T00:00:00`);
  const rangeEnd = new Date(`${rangeEndISO}T23:59:59`);

  if (!event.recurring || !event.recurrenceRule) {
    const s = parseStart(event);
    const e = parseEnd(event);
    return e >= rangeStart && s <= rangeEnd ? [event] : [];
  }

  const seedStart = parseStart(event);
  const seedEnd = parseEnd(event);
  const durationMs = seedEnd - seedStart;
  const occurrenceStarts = generateOccurrenceDates(event.recurrenceRule, seedStart, rangeStart, rangeEnd);

  return occurrenceStarts
    .map((occStart) => {
      const dateKey = toLocalISODate(occStart);
      const exception = event.exceptions?.[dateKey];
      if (exception?.cancelled) return null;

      const start = exception?.start ? new Date(exception.start) : occStart;
      const end = exception?.end ? new Date(exception.end) : new Date(occStart.getTime() + durationMs);

      return {
        ...event,
        id: `${event.id}::${dateKey}`,
        seriesId: event.id,
        isRecurrenceInstance: true,
        occurrenceDateKey: dateKey,
        start: event.allDay ? toLocalISODate(start) : toLocalISODateTime(start),
        end: event.allDay ? toLocalISODate(end) : toLocalISODateTime(end),
      };
    })
    .filter(Boolean);
}

/** Next N occurrence dates from a rule, for the "repeats every..." preview in EventDialog. */
export function previewOccurrences(rule, seedStartISO, count = 5) {
  const seedStart = new Date(seedStartISO.length === 10 ? `${seedStartISO}T00:00:00` : seedStartISO);
  const farFuture = new Date(seedStart);
  farFuture.setFullYear(farFuture.getFullYear() + 6);
  return generateOccurrenceDates(rule, seedStart, seedStart, farFuture).slice(0, count);
}

const FREQ_UNIT_LABEL = { daily: 'day', weekdays: 'weekday', weekly: 'week', biweekly: '2 weeks', monthly: 'month', yearly: 'year' };

/** Human-readable summary, e.g. "Every week until Dec 31, 2026" — drives the dialog's live preview line. */
export function describeRecurrence(rule) {
  if (!rule) return 'Does not repeat';
  let text;
  if (rule.freq === 'custom') {
    const n = rule.interval || 1;
    const unit = rule.unit || 'week';
    text = n > 1 ? `Every ${n} ${unit}s` : `Every ${unit}`;
  } else if (rule.interval && rule.interval > 1 && rule.freq !== 'biweekly' && rule.freq !== 'weekdays') {
    text = `Every ${rule.interval} ${FREQ_UNIT_LABEL[rule.freq]}s`;
  } else {
    text = `Every ${FREQ_UNIT_LABEL[rule.freq] || 'interval'}`;
  }
  if (rule.until) text += ` until ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${rule.until}T00:00:00`))}`;
  else if (rule.count) text += `, ${rule.count} time${rule.count === 1 ? '' : 's'}`;
  return text;
}

/** Marks one occurrence of a series as moved, without forking the whole series. */
export function setOccurrenceException(event, dateKey, patch) {
  const exceptions = { ...(event.exceptions || {}), [dateKey]: { ...(event.exceptions?.[dateKey] || {}), ...patch } };
  return { ...event, exceptions };
}
