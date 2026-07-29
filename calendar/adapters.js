// Atlas Calendar — External-source adapters.
//
// The calendar shows things that live in other modules (a project's
// deadline, eventually a habit's reminder time, a goal's milestone date)
// without ever copying those objects into `events` in data.js. Each adapter
// is a pure function: (rangeStart, rangeEnd) -> CalendarEvent[], computed
// fresh from the other module's real data every time. Nothing here is
// persisted, so Projects stays the single source of truth for its own
// deadlines — the calendar just projects them into its own shape.
//
// Registering a new adapter never touches calendar core code (state.js just
// iterates ADAPTERS) — that's the "unlimited integrations" part of the brief.

import { projects } from '../projects/data.js';

function projectDeadlineAdapter(rangeStartISO, rangeEndISO) {
  const rangeStart = new Date(`${rangeStartISO}T00:00:00`);
  const rangeEnd = new Date(`${rangeEndISO}T23:59:59`);

  return projects
    .filter((p) => p.deadline && p.status !== 'Archived')
    .filter((p) => {
      const d = new Date(`${p.deadline}T00:00:00`);
      return d >= rangeStart && d <= rangeEnd;
    })
    .map((p) => ({
      id: `adapter:project:${p.id}`,
      title: `${p.title} due`,
      description: p.description,
      start: p.deadline,
      end: p.deadline,
      allDay: true,
      calendarId: 'project-deadlines',
      color: null,
      location: '',
      notes: '',
      tags: p.tags,
      recurring: false,
      recurrenceRule: null,
      completed: p.status === 'Completed',
      priority: p.priority.toLowerCase(),
      type: 'deadline',
      deadline: true,
      projectId: p.id,
      habitId: null,
      goalId: null,
      attachments: [],
      reminders: [],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      googleEventId: null,
      outlookEventId: null,
      sourceProvider: 'local',
      readOnly: true,
      sourceAdapter: 'projects',
    }));
}

// No Habits module exists yet (mock-data.js only has streak counters with no
// dated reminder time to project) — this stays a documented no-op rather
// than a stub that invents fake times. Once a real habits/data.js exists
// with scheduled reminder times, implement this the same way as the
// projects adapter above and it lights up automatically.
function habitReminderAdapter(/* rangeStartISO, rangeEndISO */) {
  return [];
}

// Same story for Goals — no module, no adapter output, until one exists.
function goalMilestoneAdapter(/* rangeStartISO, rangeEndISO */) {
  return [];
}

export const ADAPTERS = [
  { id: 'projects', run: projectDeadlineAdapter },
  { id: 'habits', run: habitReminderAdapter },
  { id: 'goals', run: goalMilestoneAdapter },
];

export function getAdaptedEvents(rangeStartISO, rangeEndISO) {
  return ADAPTERS.flatMap((a) => a.run(rangeStartISO, rangeEndISO));
}
