// Atlas Calendar — Canonical data. Same role as projects/data.js and
// notes/data.js: the ONE place native calendar data lives. Project
// deadlines are deliberately NOT stored here — see adapters.js, which reads
// them live from projects/data.js so the two can never drift apart.

/**
 * @typedef {Object} RecurrenceRule
 * @property {'daily'|'weekdays'|'weekly'|'biweekly'|'monthly'|'yearly'|'custom'} freq
 * @property {number} [interval]     - used by 'monthly'/'yearly'/'custom' (default 1)
 * @property {'day'|'week'|'month'|'year'} [unit] - only for freq:'custom'
 * @property {number|null} [count]   - stop after N occurrences
 * @property {string|null} [until]   - stop after this date (inclusive), 'YYYY-MM-DD'
 * @property {Object.<string, {start?:string, end?:string, cancelled?:boolean}>} [exceptions]
 *           keyed by the occurrence's local date ('YYYY-MM-DD') — how a single
 *           instance of a recurring series gets dragged or deleted without
 *           forking the whole series (the same EXDATE/RDATE idea RFC 5545 uses).
 */

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} start          - 'YYYY-MM-DDTHH:mm:00' or 'YYYY-MM-DD' when allDay
 * @property {string} end            - same shape as start; allDay end is inclusive
 * @property {boolean} allDay
 * @property {string} calendarId     - references CALENDARS
 * @property {string|null} color     - identity color override; null = inherit from calendar
 * @property {string} [location]
 * @property {string} [notes]
 * @property {string[]} [tags]
 * @property {boolean} recurring
 * @property {RecurrenceRule|null} recurrenceRule
 * @property {boolean} completed
 * @property {'low'|'medium'|'high'|'critical'} priority
 * @property {EventTypeId} type
 * @property {boolean} deadline      - drives red-accent/overdue styling, independent of `type`
 * @property {string|null} projectId
 * @property {string|null} habitId
 * @property {string|null} goalId
 * @property {{id:string, name:string, url:string}[]} attachments
 * @property {{id:string, offsetMinutes:number, method:'notification'|'email'}[]} reminders
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} googleEventId   - future sync id, always null until a provider is wired
 * @property {string|null} outlookEventId
 * @property {'local'|'google'|'outlook'} sourceProvider
 * @property {boolean} [readOnly]     - true for adapter-sourced entries (see adapters.js)
 * @property {string} [sourceAdapter] - which adapter produced this, when readOnly
 */

// ================= CALENDARS =================
// Colors reuse the app-wide identity palette (tokens.css) — the same hues
// Projects and Notes already tag their own items with — so a color means the
// same thing everywhere in Atlas, not just within this module.

export const CALENDARS = [
  { id: 'personal', name: 'Personal', color: 'blue', visible: true, readOnly: false },
  { id: 'school', name: 'School', color: 'violet', visible: true, readOnly: false },
  { id: 'work', name: 'Work', color: 'teal', visible: true, readOnly: false },
  { id: 'fitness', name: 'Fitness', color: 'emerald', visible: true, readOnly: false },
  // Populated live by adapters.js from Projects — never written to directly,
  // and marked readOnly so the UI won't offer to drag or edit its entries.
  { id: 'project-deadlines', name: 'Project Deadlines', color: 'rose', visible: true, readOnly: true },
];

export function getCalendar(id) {
  return CALENDARS.find((c) => c.id === id) || { id, name: id, color: 'slate', visible: true, readOnly: false };
}

let calendarIdCounter = CALENDARS.length;
export function createCalendar(name, color = 'slate') {
  calendarIdCounter += 1;
  const cal = { id: `cal-${calendarIdCounter}-${Date.now()}`, name, color, visible: true, readOnly: false };
  CALENDARS.push(cal);
  return cal;
}

export const CALENDAR_COLORS = ['blue', 'violet', 'teal', 'amber', 'rose', 'emerald', 'slate'];

// ================= EVENT TYPES =================
// Each type only owns an icon + label. Visual color comes from the calendar
// (or an explicit per-event override) — keeping "what kind of thing is this"
// separate from "how is it painted" avoids the two systems fighting for the
// same pixel the way a 5th badge color would.

/** @typedef {'normal'|'meeting'|'deadline'|'habit'|'goal'|'birthday'|'exam'|'assignment'|'custom'} EventTypeId */

export const EVENT_TYPE_CONFIG = {
  normal: { icon: 'calendar', label: 'Event' },
  meeting: { icon: 'users', label: 'Meeting' },
  deadline: { icon: 'alertTriangle', label: 'Project Deadline' },
  habit: { icon: 'flame', label: 'Habit Reminder' },
  goal: { icon: 'award', label: 'Goal Milestone' },
  birthday: { icon: 'cake', label: 'Birthday' },
  exam: { icon: 'graduationCap', label: 'Exam' },
  assignment: { icon: 'fileCheck', label: 'Assignment' },
  custom: { icon: 'moreHorizontal', label: 'Custom' },
};
export const EVENT_TYPES = Object.keys(EVENT_TYPE_CONFIG);

export const PRIORITY_CONFIG = {
  low: { color: 'neutral' },
  medium: { color: 'warning' },
  high: { color: 'danger' },
  critical: { color: 'danger' },
};
export const PRIORITIES = Object.keys(PRIORITY_CONFIG);

export const REMINDER_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '0', label: 'At time of event' },
  { value: '5', label: '5 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '1440', label: '1 day before' },
];

export const RECURRENCE_FREQUENCIES = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekdays', label: 'Every weekday' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'custom', label: 'Custom' },
];

export const CUSTOM_RECURRENCE_UNITS = [
  { id: 'day', label: 'Day(s)' },
  { id: 'week', label: 'Week(s)' },
  { id: 'month', label: 'Month(s)' },
  { id: 'year', label: 'Year(s)' },
];

// ================= SEED EVENTS =================
// Dates are fixed to real July–September 2026 values on purpose, the same
// convention projects/data.js and notes/data.js already use, so "today",
// "overdue", and "this week" line up with the rest of the app's mock data
// instead of just this module's.

export const events = [
  {
    id: 'ev1', title: 'Team Sync', description: 'Weekly cross-team status check-in.',
    start: '2026-06-02T14:00:00', end: '2026-06-02T14:30:00', allDay: false,
    calendarId: 'work', color: null, location: 'Zoom', notes: '', tags: ['Atlas'],
    recurring: true, recurrenceRule: { freq: 'weekly', interval: 1, count: null, until: null },
    completed: false, priority: 'medium', type: 'meeting', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r1', offsetMinutes: 10, method: 'notification' }],
    createdAt: '2026-06-01', updatedAt: '2026-06-01',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev2', title: 'Dentist appointment', description: 'Regular cleaning, Dr. Iyer.',
    start: '2026-07-28T16:30:00', end: '2026-07-28T17:15:00', allDay: false,
    calendarId: 'personal', color: null, location: 'Bright Smile Dental', notes: '', tags: [],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'low', type: 'normal', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r2', offsetMinutes: 60, method: 'notification' }],
    createdAt: '2026-07-10', updatedAt: '2026-07-10',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev3', title: '1:1 with Sarah', description: 'Regular check-in.',
    start: '2026-07-29T10:00:00', end: '2026-07-29T10:30:00', allDay: false,
    calendarId: 'work', color: null, location: '', notes: 'Send her the Q3 planning notes beforehand.', tags: ['Work'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'medium', type: 'meeting', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [],
    createdAt: '2026-07-20', updatedAt: '2026-07-20',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev4', title: 'Design Review', description: 'Onboarding flow screens, round 2.',
    start: '2026-07-29T10:15:00', end: '2026-07-29T11:00:00', allDay: false,
    calendarId: 'work', color: null, location: 'Conference Room B', notes: '', tags: ['Startup', 'Product'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'medium', type: 'meeting', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r4', offsetMinutes: 15, method: 'notification' }],
    createdAt: '2026-07-21', updatedAt: '2026-07-21',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev5', title: 'Q3 Planning Sync', description: 'Decisions on marketing site, migration buffer, onboarding deadline.',
    start: '2026-07-30T11:00:00', end: '2026-07-30T12:00:00', allDay: false,
    calendarId: 'work', color: null, location: 'Conference Room B', notes: '', tags: ['Work', 'Startup'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'high', type: 'meeting', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r5', offsetMinutes: 30, method: 'notification' }],
    createdAt: '2026-07-18', updatedAt: '2026-07-22',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev6', title: 'Organic Chemistry Midterm', description: 'SN1 vs SN2 mechanisms, energy diagrams, transition states.',
    start: '2026-07-31T09:00:00', end: '2026-07-31T11:00:00', allDay: false,
    calendarId: 'school', color: null, location: 'Hall B, Room 204', notes: '', tags: ['University'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'high', type: 'exam', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r6', offsetMinutes: 1440, method: 'notification' }],
    createdAt: '2026-07-01', updatedAt: '2026-07-01',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev7', title: 'Problem Set 4 Due', description: 'Reaction mechanism problem set, chapters 5\u20137.',
    start: '2026-08-03', end: '2026-08-03', allDay: true,
    calendarId: 'school', color: null, location: '', notes: '', tags: ['University'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'medium', type: 'assignment', deadline: true,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r7', offsetMinutes: 1440, method: 'notification' }],
    createdAt: '2026-07-15', updatedAt: '2026-07-15',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev8', title: 'Morning Run', description: '5k easy pace.',
    start: '2026-07-06T06:30:00', end: '2026-07-06T07:15:00', allDay: false,
    calendarId: 'fitness', color: null, location: '', notes: '', tags: ['Health'],
    recurring: true, recurrenceRule: { freq: 'weekdays', interval: 1, count: null, until: null },
    completed: false, priority: 'low', type: 'habit', deadline: false,
    projectId: null, habitId: 'habit-morning-run', goalId: null, attachments: [],
    reminders: [],
    createdAt: '2026-07-01', updatedAt: '2026-07-01',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev9', title: 'Marathon Long Run', description: '18\u201320 miles \u2014 longest one before taper.',
    start: '2026-08-02T07:00:00', end: '2026-08-02T10:00:00', allDay: false,
    calendarId: 'fitness', color: null, location: 'Riverside Trail', notes: 'Twelve weeks out from race day.', tags: ['Personal', 'Health'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'medium', type: 'habit', deadline: false,
    projectId: null, habitId: 'habit-morning-run', goalId: null, attachments: [],
    reminders: [{ id: 'r9', offsetMinutes: 720, method: 'notification' }],
    createdAt: '2026-07-19', updatedAt: '2026-07-19',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev10', title: "Mom's Birthday", description: '',
    start: '2020-08-05', end: '2020-08-05', allDay: true,
    calendarId: 'personal', color: null, location: '', notes: 'Call in the morning, card is already in the mail.', tags: ['Personal'],
    recurring: true, recurrenceRule: { freq: 'yearly', interval: 1, count: null, until: null },
    completed: false, priority: 'low', type: 'birthday', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r10', offsetMinutes: 1440, method: 'notification' }],
    createdAt: '2020-07-01', updatedAt: '2020-07-01',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev11', title: 'Weekly Grocery Run', description: '',
    start: '2026-06-06T10:00:00', end: '2026-06-06T11:00:00', allDay: false,
    calendarId: 'personal', color: null, location: '', notes: '', tags: ['Personal'],
    recurring: true, recurrenceRule: { freq: 'weekly', interval: 1, count: null, until: null },
    completed: false, priority: 'low', type: 'normal', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [],
    createdAt: '2026-06-01', updatedAt: '2026-06-01',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev12', title: 'Newsletter Draft #1 Due', description: 'Hash routing, component systems, design tokens interview.',
    start: '2026-07-30', end: '2026-07-30', allDay: true,
    calendarId: 'personal', color: null, location: '', notes: '', tags: ['Writing', 'Ideas'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'medium', type: 'deadline', deadline: true,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [{ id: 'r12', offsetMinutes: 1440, method: 'notification' }],
    createdAt: '2026-07-15', updatedAt: '2026-07-25',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev13', title: 'Golden Hour Portfolio Shoot', description: 'Film scans selection for the portfolio.',
    start: '2026-08-01T19:30:00', end: '2026-08-01T21:00:00', allDay: false,
    calendarId: 'personal', color: 'amber', location: 'Marina Overlook', notes: '', tags: ['Personal', 'Creative'],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'low', type: 'custom', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [],
    createdAt: '2026-07-22', updatedAt: '2026-07-22',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
  {
    id: 'ev14', title: 'Yoga Class', description: '',
    start: '2026-07-02T18:00:00', end: '2026-07-02T19:00:00', allDay: false,
    calendarId: 'fitness', color: null, location: 'Studio 3', notes: '', tags: ['Health'],
    recurring: true, recurrenceRule: { freq: 'weekly', interval: 1, count: null, until: null },
    completed: false, priority: 'low', type: 'habit', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [],
    reminders: [],
    createdAt: '2026-06-25', updatedAt: '2026-06-25',
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  },
];

let idCounter = events.length;
export function createEventId() {
  idCounter += 1;
  return `ev${idCounter}-${Date.now()}`;
}

export function createBlankEvent(seedDateISO) {
  const now = new Date().toISOString().slice(0, 19);
  return {
    id: null, // assigned on save
    title: '', description: '',
    start: `${seedDateISO}T09:00:00`, end: `${seedDateISO}T10:00:00`, allDay: false,
    calendarId: CALENDARS.find((c) => !c.readOnly)?.id || 'personal',
    color: null, location: '', notes: '', tags: [],
    recurring: false, recurrenceRule: null,
    completed: false, priority: 'medium', type: 'normal', deadline: false,
    projectId: null, habitId: null, goalId: null, attachments: [], reminders: [],
    createdAt: now, updatedAt: now,
    googleEventId: null, outlookEventId: null, sourceProvider: 'local',
  };
}
