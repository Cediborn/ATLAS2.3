// Atlas Calendar — Page state. Same discipline as projects/state.js and
// notes/state.js: state is page-scoped (not the global store.js), filtering
// is pure functions, and UI state (drag/popover/dialog) is kept in its own
// slice, never mixed with the event data itself.

import { events as nativeEvents, CALENDARS, getCalendar } from './data.js';
import { expandRecurrence, setOccurrenceException } from './recurrence.js';
import { getAdaptedEvents } from './adapters.js';
import { atMidnight, addDays, toLocalISODate, startOfWeek, startOfMonth } from '../date-utils.js';

// ================= UI STATE =================

const listeners = new Set();

function todayISO() {
  return toLocalISODate(new Date());
}

let state = {
  selectedDate: todayISO(),
  view: 'month', // 'month' | 'week' | 'day' | 'agenda'
  search: '',
  filters: {
    calendarIds: new Set(),
    priorities: new Set(),
    types: new Set(),
    completed: null, // null | true | false
    timeframe: null, // null | 'today' | 'week' | 'month'
    hasReminder: false,
    recurringOnly: false,
    allDayOnly: false,
  },
  drag: { eventId: null, previewLabel: null },
  popover: { eventId: null, anchor: null },
  dialog: { open: false, mode: 'create', draft: null, sourceDateKey: null },
  upcomingCollapsed: false,
  leftRailOpen: false, // mobile off-canvas state for the mini-calendar rail
};

export function getState() {
  return state;
}

export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetFilters() {
  setState({
    search: '',
    filters: {
      calendarIds: new Set(), priorities: new Set(), types: new Set(),
      completed: null, timeframe: null, hasReminder: false, recurringOnly: false, allDayOnly: false,
    },
  });
}

// ================= RANGE HELPERS (pure) =================

export function getRangeForView(view, selectedDateISO) {
  const d = new Date(`${selectedDateISO}T00:00:00`);

  if (view === 'month') {
    const monthStart = startOfMonth(d);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const gridStart = startOfWeek(monthStart, 0);
    const gridEnd = addDays(startOfWeek(monthEnd, 0), 6);
    return { start: toLocalISODate(gridStart), end: toLocalISODate(gridEnd), focusStart: toLocalISODate(monthStart), focusEnd: toLocalISODate(monthEnd) };
  }
  if (view === 'week') {
    const start = startOfWeek(d, 0);
    return { start: toLocalISODate(start), end: toLocalISODate(addDays(start, 6)) };
  }
  if (view === 'day') {
    return { start: selectedDateISO, end: selectedDateISO };
  }
  // agenda: a rolling window, grown by the view itself as the person scrolls
  return { start: toLocalISODate(addDays(d, -3)), end: toLocalISODate(addDays(d, 30)) };
}

export function shiftSelectedDate(view, selectedDateISO, direction) {
  const d = new Date(`${selectedDateISO}T00:00:00`);
  if (view === 'month') d.setMonth(d.getMonth() + direction);
  else if (view === 'week' || view === 'agenda') d.setDate(d.getDate() + 7 * direction);
  else d.setDate(d.getDate() + direction);
  return toLocalISODate(d);
}

// ================= EVENT RESOLUTION (pure, memoized) =================

function collectEventsInRange(rangeStartISO, rangeEndISO) {
  const native = nativeEvents.flatMap((e) => expandRecurrence(e, rangeStartISO, rangeEndISO));
  const adapted = getAdaptedEvents(rangeStartISO, rangeEndISO);
  return [...native, ...adapted];
}

export function filterEvents(list, filters, search, calendars) {
  const q = search.trim().toLowerCase();
  const hiddenCalendarIds = new Set(calendars.filter((c) => !c.visible).map((c) => c.id));

  return list.filter((e) => {
    if (hiddenCalendarIds.has(e.calendarId)) return false;

    if (q) {
      const project = e.projectId ? '' : ''; // project title search handled via title already ("<Project> due")
      const haystack = [e.title, e.description, e.location, ...(e.tags || [])].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.calendarIds.size && !filters.calendarIds.has(e.calendarId)) return false;
    if (filters.priorities.size && !filters.priorities.has(e.priority)) return false;
    if (filters.types.size && !filters.types.has(e.type)) return false;
    if (filters.completed === true && !e.completed) return false;
    if (filters.completed === false && e.completed) return false;
    if (filters.hasReminder && !(e.reminders && e.reminders.length)) return false;
    if (filters.recurringOnly && !e.recurring && !e.isRecurrenceInstance) return false;
    if (filters.allDayOnly && !e.allDay) return false;

    if (filters.timeframe) {
      const start = new Date(e.allDay ? `${e.start}T00:00:00` : e.start);
      const today = atMidnight(new Date());
      if (filters.timeframe === 'today' && toLocalISODate(start) !== toLocalISODate(today)) return false;
      if (filters.timeframe === 'week') {
        const weekStart = startOfWeek(today, 0);
        const weekEnd = addDays(weekStart, 6);
        if (start < weekStart || start > addDays(weekEnd, 1)) return false;
      }
      if (filters.timeframe === 'month') {
        if (start.getFullYear() !== today.getFullYear() || start.getMonth() !== today.getMonth()) return false;
      }
    }

    return true;
  });
}

function sortByStart(list) {
  return [...list].sort((a, b) => new Date(a.allDay ? `${a.start}T00:00:00` : a.start) - new Date(b.allDay ? `${b.start}T00:00:00` : b.start));
}

let lastKey = null;
let lastResult = null;

/** The one function every view calls: real + recurring + adapter events, filtered, searched, sorted. */
export function getVisibleEventsInRange(rangeStartISO, rangeEndISO) {
  const key = JSON.stringify({
    r: [rangeStartISO, rangeEndISO],
    search: state.search,
    f: {
      cal: [...state.filters.calendarIds].sort(),
      pri: [...state.filters.priorities].sort(),
      typ: [...state.filters.types].sort(),
      comp: state.filters.completed,
      tf: state.filters.timeframe,
      rem: state.filters.hasReminder,
      rec: state.filters.recurringOnly,
      ad: state.filters.allDayOnly,
    },
    cals: CALENDARS.map((c) => `${c.id}:${c.visible}`).join(','),
    n: nativeEvents.length,
  });
  if (key === lastKey) return lastResult;
  lastKey = key;
  const raw = collectEventsInRange(rangeStartISO, rangeEndISO);
  lastResult = sortByStart(filterEvents(raw, state.filters, state.search, CALENDARS));
  return lastResult;
}

export function invalidateEventsCache() {
  lastKey = null;
}

export function hasActiveFilters() {
  const f = state.filters;
  return Boolean(state.search || f.calendarIds.size || f.priorities.size || f.types.size || f.completed !== null || f.timeframe || f.hasReminder || f.recurringOnly || f.allDayOnly);
}

// ================= MUTATIONS =================

export function toggleCalendarVisibility(calendarId) {
  const cal = getCalendar(calendarId);
  cal.visible = !cal.visible;
  invalidateEventsCache();
}

function findNativeEvent(id) {
  return nativeEvents.find((e) => e.id === id);
}

/** Handles both plain events and `${seriesId}::${dateKey}` recurrence instances. */
export function rescheduleEvent(eventId, newStartISO, newEndISO) {
  const sepIndex = eventId.indexOf('::');
  if (sepIndex === -1) {
    const ev = findNativeEvent(eventId);
    if (!ev || ev.readOnly) return false;
    ev.start = newStartISO;
    ev.end = newEndISO;
    ev.updatedAt = todayISO();
    invalidateEventsCache();
    return true;
  }
  const seriesId = eventId.slice(0, sepIndex);
  const dateKey = eventId.slice(sepIndex + 2);
  const series = findNativeEvent(seriesId);
  if (!series) return false;
  const updated = setOccurrenceException(series, dateKey, { start: newStartISO, end: newEndISO });
  Object.assign(series, updated);
  invalidateEventsCache();
  return true;
}

export function toggleEventCompleted(eventId) {
  const seriesId = eventId.includes('::') ? eventId.split('::')[0] : eventId;
  const ev = findNativeEvent(seriesId);
  if (!ev) return;
  ev.completed = !ev.completed;
  ev.updatedAt = todayISO();
  invalidateEventsCache();
}

export function addEvent(eventData) {
  nativeEvents.push(eventData);
  invalidateEventsCache();
}

export function updateEvent(eventId, patch) {
  const ev = findNativeEvent(eventId);
  if (!ev) return;
  Object.assign(ev, patch, { updatedAt: todayISO() });
  invalidateEventsCache();
}

export function deleteEvent(eventId) {
  const seriesId = eventId.includes('::') ? eventId.split('::')[0] : eventId;
  const idx = nativeEvents.findIndex((e) => e.id === seriesId);
  if (idx !== -1) nativeEvents.splice(idx, 1);
  invalidateEventsCache();
}

export function deleteOccurrence(eventId) {
  const sepIndex = eventId.indexOf('::');
  if (sepIndex === -1) return deleteEvent(eventId);
  const seriesId = eventId.slice(0, sepIndex);
  const dateKey = eventId.slice(sepIndex + 2);
  const series = findNativeEvent(seriesId);
  if (!series) return;
  Object.assign(series, setOccurrenceException(series, dateKey, { cancelled: true }));
  invalidateEventsCache();
}

export { todayISO };
