# Calendar module — integration notes

## What's in this zip

A complete, runnable copy of Atlas with the new Calendar module wired in, plus
the handful of existing files it touches. Everything else (Dashboard,
Settings, Notes, the shell) is unchanged — included so the zip actually runs,
not just as a diff.

**One known gap:** `js/projects/view.js` was never part of our conversation —
only `projects/data.js`, `state.js`, and `components.js` were shared, so the
Projects module's own view controller isn't reconstructed here. Everything
else works standalone, including Calendar's read of Projects' *data*
(`adapters.js` imports `projects/data.js` directly, which *is* present).
Clicking "Projects" in the sidebar in this zip specifically will 404 on that
one dynamic import; drop your real `projects/view.js` in and it resolves.

## Running it

```bash
cd atlas
python3 -m http.server 8000
# open http://localhost:8000/app/index.html
```

(Module scripts don't execute over `file://` in Chrome — see the main README.)

## New files

```
js/calendar/
  data.js            Event model, calendars, event-type/recurrence config, seed events
  recurrence.js      Recurrence engine (daily/weekdays/weekly/biweekly/monthly/yearly/custom)
  adapters.js        Reads Project deadlines live — never copies them
  providers.js       Google/Outlook sync interface (Local is real; the other two document the shape)
  state.js           Selected date/view/filters/search/drag/popover/dialog state + pure selectors
  components.js      EventCard, pills, badges, calendar rows, empty/loading states
  month-view.js      Traditional month grid
  time-grid.js       Shared hour-grid engine (overlap layout, current-time line) — Week and Day both use this
  week-view.js       7-day wrapper around time-grid.js
  day-view.js        1-day wrapper around time-grid.js
  agenda-view.js      Grouped-by-date feed with real windowed "infinite scroll"
  mini-calendar.js    Small month nav, independent cursor, event dots
  upcoming-panel.js    Today / Tomorrow / Next 7 Days / Overdue Deadlines, collapsible
  toolbar.js          Nav, search, filter menu, calendar selector, view switcher, create button
  event-dialog.js      Create/Edit form: validation, recurrence builder + live preview, reminders
  drag-controller.js   Reusable pointer-based drag-to-reschedule
  view.js              Page controller — the module's entry point

css/calendar.css      All calendar styling, `cal-` prefixed so nothing collides with existing classes
```

## Edited files (and why)

| File | Change |
|---|---|
| `js/router.js` | Added the `calendar` branch, lazy-loading `calendar/view.js` exactly like `projects`/`notes` already do |
| `js/date-utils.js` | Added local-safe ISO formatting + week/month boundary helpers (additive only) — Calendar needed the same treatment Notes already got in this file |
| `js/icons.js` | Added 11 icons (`chevronLeft`, `clock`, `mapPin`, `repeat`, `alertTriangle`, `gripVertical`, `plus`, `cake`, `graduationCap`, `fileCheck`, `award`) — nothing existing changed |
| `js/mock-data.js` | Removed `dashboardData.events` (superseded — see `views.js` below) |
| `js/views.js` | Dashboard's "Upcoming Events" section and "Events Today" stat now read live from the Calendar module, the same "one source of truth" move already used for Recent Projects/Notes |
| `css/dashboard.css` | Added the 7 identity-color modifiers to `.event-item__color` so the dashboard can show a real calendar color, not just 4 semantic ones |
| `css/components.css` | Added `.field select` / `.field textarea` — the Event dialog needed both inside the existing `.field` wrapper Settings already uses |
| `app/index.html` | Added the `calendar.css` link |
| `README.md` | Corrected the "Scope of this shell" section, which still listed Projects/Notes as unbuilt roadmap items |

## Three decisions worth flagging

**No React/TypeScript/Framer Motion.** The brief asked for these, but Atlas
is deliberately a no-build-step, framework-free static site (see the
original README) — introducing a React toolchain would mean nothing here
actually runs without a bundler, breaking the one constraint the rest of the
app is built around. Animations use CSS transitions/keyframes on the
existing `--duration-*`/`--ease-atlas` tokens, plus the View Transitions API
(feature-detected, and skipped under `prefers-reduced-motion`) for the
Month/Week/Day/Agenda swap — same visual result, zero new dependencies.

**Google/Outlook sync is an interface, not a simulation.** `providers.js`
defines the exact shape a real integration would implement. Calling
`connect()` on `GoogleProvider`/`OutlookProvider` today rejects with a clear
error rather than faking success — Atlas has no backend or OAuth flow to back
a real connection, and pretending otherwise would be worse than not having
the feature.

**Adapters only wire what has real data behind them.** Project deadlines are
live (via `projects/data.js`) and drive the "Project Deadlines" calendar and
the Upcoming panel's overdue section. Habit/Goal adapters exist as
documented no-ops, since neither module has dated records to project yet —
they'll light up with zero changes to calendar core once one does.
