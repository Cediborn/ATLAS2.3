# Atlas — Build Log

Complete record of everything built so far: every file, every decision and why, every component's exact props, every data field, every accessibility feature, every bug caught during validation, and everything deliberately deferred. Written as project documentation, not just a chat recap — meant to be readable on its own by you or a future session.

Current state: **25 files, ~4,060 lines of HTML/CSS/JS.** Static site, zero build step, zero backend, deployable to GitHub Pages as-is.

---

## 1. Timeline

### 1.1 — Landing page + application shell
No landing page existed anywhere in the project or uploads at the time — checked `/mnt/project` and `/mnt/user-data/uploads` directly rather than assuming, per the standing rule to verify before building. Built one from scratch using the design tokens already specified in `ATLAS_FOUNDATION.md` §7, plus the full app shell: sidebar, top nav, workspace switcher, command palette, dashboard, settings.

Key decisions made here, still load-bearing for everything after:
- **Hash-based routing** (`#/dashboard`, `#/projects`, …) instead of path-based routing — a client-routed static SPA with path-based routes 404s on hard refresh under GitHub Pages unless you add server rewrite rules, which a no-build static site can't easily do. Hash routing sidesteps this entirely.
- **Native ES modules**, one file per responsibility, no bundler — chosen specifically so the code maps 1:1 onto future React components/hooks when Atlas eventually moves to Next.js per the Foundation roadmap, without pretending this is React today.
- **Hand-built inline SVG icons** (24px grid, 2px stroke, round caps — Lucide's visual language, not its exact path data) instead of a CDN icon font/library — zero runtime dependency, zero icon-flash on load.
- **A small custom observable store** (`store.js`) instead of any state library — get/set/subscribe, backed by `localStorage` for theme, workspace, and sidebar-collapsed state (deliberately *not* persisting whether the mobile drawer is open).
- **Signature accent color** `#3654E0` — chosen deliberately over the two most common "this looks AI-generated" defaults (warm-cream-and-terracotta, or near-black-and-neon) and over generic Tailwind-indigo. Paired with a warm-tinted neutral gray scale rather than cold gray.
- **The command palette as the one signature moment** — real ARIA combobox/listbox semantics (not a fake lookalike), arrow-key navigation, unified so the topbar's search pill and ⌘K open the exact same overlay instead of two competing systems.
- Landing page hero **shows** the product's ambient-AI/quick-capture pillar instead of describing it — a live typewriter demo cycling through example inputs ("call sarah tomorrow 3pm" → parsed task) rather than a generic hero stat block.

### 1.2 — GitHub Pages upload issue
Screenshot showed the whole `atlas-site` folder nested one level inside the repo instead of its contents sitting at the root, so `index.html` wasn't where Pages looks for it. Diagnosed as a drag-and-drop artifact (uploaded the outer folder instead of its contents) and flagged that `.nojekyll` is a dotfile some file pickers hide from drag-and-drop, so it may not have made it in.

### 1.3 — Real landing page wiring
You uploaded the actual pre-existing `atlas-landing.html` — a full marketing/waitlist page that hadn't been visible to me in step 1.1. Found both CTAs (`nav__cta` line 1115 "Get early access", hero `btn-primary` line 1143 "Start building") pointing at `#cta`, an email-capture anchor, instead of the app. Gave the exact two-line fix (`href="app/index.html"`) and flagged that this file is fully self-contained (styles/script inlined) and doesn't touch the `css/`/`js/`/`assets/` folders at all.

### 1.4 — Dashboard rebuilt on reusable components ("Day 6")
You gave a full component-system spec (StatCard, SectionCard, 5 list-item types, Progress, Badge, QuickActionButton, EmptyState) with "take every part of the prompt easily, don't assume anything." Four real ambiguities in that spec were resolved explicitly rather than silently:
1. **Quick Actions: 4 items or 6?** The component spec's examples listed 6; the actual dashboard-layout section listed 4 and required a clean 2×2 grid on mobile. 6 doesn't tile into 2×2; 4 does — went with 4.
2. **TaskItem's "due time"** wasn't in the component's own prop list but was required by the layout section — added as an extra optional prop rather than dropped.
3. **Habit "completion ring or progress"** — ambiguous phrase. Implemented *both* readings: a weekly completion Progress bar and a separate daily "done today" toggle, rather than guessing one.
4. **Empty-state duplication** — unified the existing full-page empty state and a new compact in-card one into a single `emptyState()` function with a `size` variant, instead of two parallel implementations.

Built `js/components.js` as the shared library; rewrote `views.js` entirely around it; renamed `.panel`→`.section-card` and `*-row`→`*-item` throughout for naming consistency (checked afterward that no old names were left anywhere). Built a real 12-column CSS Grid for the desktop layout with three genuine responsive tiers (not one breakpoint doing double duty). Refactored the Settings page to also use `SectionCard`, proving the components work outside the dashboard too.

Two real bugs caught by validation and fixed: a dead `--space-20` CSS variable that always fell back to `--space-16` anyway (simplified to just use `--space-16`), and a missing `.quick-action__label` CSS rule.

### 1.5 — Projects module, Milestone 1
Spec was written in React vocabulary (`<ProjectCard>`, hooks, memoization, lazy-loaded views) for a project that's still plain HTML/CSS/JS. Translated rather than ignored: components → functions(props); hooks/state → the same store pattern; memoization → a real cache, not a claim; lazy-loaded views → a genuine dynamic `import()`.

Scope was split into a milestone rather than attempting all 22 named components, 3 views, and drag-and-drop shallowly in one pass (per your own instruction not to exhaust the response budget recklessly, and the standing project rule to break oversized requests into milestones). Built completely: data model + 14 realistic projects, both color systems, all 4 Progress variants, 11 of the Projects components, the Grid view, a full toolbar (search/new/view-switcher/filter/sort), and a real slide-in detail panel. Explicitly deferred: List/Kanban views, drag-and-drop, the New Project form, Import/Export, and several filter facets (see §9).

Consolidated the dashboard's "Recent Projects" section to read live from this new canonical dataset instead of keeping a second, separately-maintained copy that had already drifted (its old mock statuses, "Active"/"Paused", didn't even match the new official 7-status list).

One real bug caught and fixed during validation: the filter/sort memoization cache didn't invalidate when a project's own data mutated (e.g. archiving a card from its action menu), so toggling archive while "show archived" was off wouldn't actually have removed it from the grid. Added an explicit `invalidateVisibleProjectsCache()` call at the one place that mutates project data.

---

## 2. Complete file tree

```
/index.html                     Landing page (hero demo, philosophy, 8 pillars, Launch Atlas CTA)
/app/index.html                 App shell: sidebar + topbar + command palette + view root
/.nojekyll                      Tells GitHub Pages not to run this through Jekyll
/README.md                      Structure, local-preview instructions, deploy steps
/docs/BUILD_LOG.md              This file

/assets/favicon.svg             Geometric "A" monogram, reused as the landing nav logo

/css/tokens.css                 Every design token: color (light+dark), type, spacing, radius, motion, elevation
/css/base.css                   Reset, focus states, skip link, reduced-motion override, scrollbar styling
/css/components.css             Shared atoms: buttons, badges, menus/dropdowns, avatar, empty state, progress bar, inputs
/css/app-shell.css              Sidebar, topbar, workspace switcher, command palette layout, responsive rules
/css/dashboard.css              Hero, StatCard, quick actions, 12-col grid, SectionCard, all 5 list-item types
/css/landing.css                Landing-page-only layout (hero, philosophy strip, pillar cards, footer)
/css/projects.css               Status/priority indicators, ring/percentage/milestone progress, cards, toolbar, detail panel

/js/icons.js                    Icon registry — one hand-built inline SVG per name, no external dependency
/js/store.js                    ~30-line observable store (theme, workspace, sidebar state) + localStorage
/js/theme.js                    Resolves light/dark/system, applies data-theme, reacts to system changes
/js/mock-data.js                User, workspaces, nav config, notifications, dashboard content (tasks/events/habits/notes/learning), quick actions
/js/popover.js                  One shared dropdown behavior, reused by workspace switcher / notifications / profile menu
/js/sidebar.js                  Nav rendering, mobile drawer, desktop collapse, workspace switcher logic
/js/topbar.js                   Date, page title, notifications dropdown, profile dropdown
/js/command-palette.js          ⌘K/Ctrl+K palette — real ARIA combobox pattern, arrow-key nav, unified search+actions
/js/components.js               Shared component library: Badge, Progress, emptyState, StatCard, SectionCard, QuickActionButton, TaskItem, EventItem, ProjectItem, NoteItem, HabitItem
/js/views.js                    Dashboard, Settings, and full-page empty-state renderers — assembled entirely from components.js
/js/router.js                   Hash router; dynamically imports the Projects module only when visited
/js/main.js                     App bootstrap — the one file that wires every module together
/js/landing.js                  Landing-page-only script: hero typewriter demo, philosophy/pillar rendering

/js/projects/data.js            Canonical project data — 14 projects, people roster, status/priority config
/js/projects/state.js           Pure filter/sort functions, page-local reactive state, date helpers, memoized selector
/js/projects/components.js      ProjectStatusBadge, ProjectPriority, ProjectProgress, ProjectDeadline, ProjectAvatarGroup, ProjectTag, ProjectEmptyState, ProjectSkeleton, ProjectActionMenu, ProjectHeader, ProjectCard
/js/projects/view.js             Page controller: toolbar, grid, detail panel — the only file in the module that touches the DOM
```

---

## 3. Design tokens (`css/tokens.css`)

| Category | Values |
|---|---|
| Type | Inter (UI), JetBrains Mono (code/data), loaded via Google Fonts with `font-display:swap` |
| Type scale | 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40px (`--text-xs` → `--text-3xl`) |
| Spacing | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px, named directly by pixel value |
| Radius | 6px inputs/buttons, 12px cards, 20px modals, plus a full-pill radius |
| Motion | 120ms micro, 200ms standard, 320ms panel — `cubic-bezier(0.16, 1, 0.3, 1)` easing throughout |
| Elevation | Two shadow tokens (`--shadow-float`, `--shadow-modal`); everything else uses 1px hairline borders, not shadows |

**Light theme:** bg `#FAFAF9`, bg-inset `#F2F1EE`, surface `#FFFFFF`, text `#14151A`, accent-solid `#3654E0`, success `#0F6B3D`, warning `#8A5210`, danger `#B02A2A`.

**Dark theme:** bg `#0B0C0F`, surface `#16181F`, text `#F5F5F3`, accent-text `#7C97FF` (lighter tint for contrast against near-black — accent-*solid* stays `#3654E0` in both themes since filled buttons need the same fill regardless of page theme; only the text/icon-on-background version needs to lighten).

**Added for the Projects module:** `--color-planning` (`#6D4FC4` light / `#A78BFA` dark), `--color-archived` (`#8A7B6C` light / `#B8AA9A` dark) — added only because nothing existing fit; everything else in the 7-status system reuses accent/success/warning/danger. Plus 7 project-*identity* colors (independent of status): blue `#3B82F6`, violet `#8B5CF6`, teal `#14B8A6`, amber `#F59E0B`, rose `#F43F5E`, emerald `#10B981`, slate `#64748B`.

**Layout constants:** sidebar 260px expanded / 72px collapsed, topbar 64px tall.

---

## 4. Component library

### 4.1 — `js/components.js` (app-wide)
| Component | Props |
|---|---|
| `Badge` | `label`, `variant?` — auto-maps status words to a color if `variant` isn't given |
| `Progress` | `percentage`, `label?`, `color?` |
| `emptyState` | `icon`, `title`, `description?`, `size?` ('sm' for in-card, default for full-page), `badge?` |
| `StatCard` | `title`, `value`, `icon`, `trend?`, `accent?` |
| `SectionCard` + `sectionAction` | `title`, `description?`, `action?`, `content` |
| `QuickActionButton` | `icon`, `label`, `id` |
| `TaskItem` | `id`, `title`, `category`, `priority?`, `dueTime?`, `done` |
| `EventItem` | `id`, `time`, `title`, `location?`, `color` |
| `ProjectItem` | `id`, `name`, `status`, `lastUpdated`, `progress?` — the dashboard's lightweight preview row, distinct from the Projects module's `ProjectCard` |
| `NoteItem` | `id`, `title`, `editedDate`, `tag?` |
| `HabitItem` | `id`, `name`, `icon?`, `streak`, `completedToday?`, `weeklyProgress?` |

### 4.2 — `js/projects/components.js` (Projects module)
`ProjectStatusBadge`, `ProjectPriority` (Critical = High's exact hue rendered solid instead of tinted — escalates by weight, not a 5th color), `ProjectProgress` (4 variants: bar *reuses* the app-wide `Progress` directly rather than reimplementing it; ring/percentage/milestone are new), `ProjectDeadline` (none / normal / soon / overdue, computed live against today's date), `ProjectAvatarGroup` (overlapping stack + overflow count), `ProjectTag` (clickable — filters the grid), `ProjectEmptyState`, `ProjectSkeleton`, `ProjectActionMenu` (favorite / pin / archive), `ProjectHeader` (reused by both the card and the detail panel), `ProjectCard`.

---

## 5. Data models

**`mock-data.js`:** `currentUser` (name/email/initials), `workspaces` (3: Personal/University/Startup), `navItems` (11: Dashboard, Projects, Calendar, Notes, Habits, Goals, Learning, Finance, Books, Coding, Settings — each with an optional roadmap `phase`), `notifications` (3), `dashboardData` (stats/tasks/events/habits/notes/learning), `quickActions` (4: Task/Note/Project/Event).

**`projects/data.js`:** 6-person roster (Alex Morgan, Sarah Chen, Jordan Lee, Priya Patel, Marcus Webb, Nina Ortiz), 7 statuses (Not Started, Planning, In Progress, Blocked, Review, Completed, Archived), 4 priorities (Low, Medium, High, Critical), 7 project-identity colors, and **14 projects**, each carrying: `id`, `title`, `description`, `icon` (emoji), `status`, `priority`, `deadline`, `estimatedCompletion`, `progress`, `owner`, `members[]`, `color`, `createdAt`, `updatedAt`, `lastActivity`, `tags[]`, `taskCount`, `completedTaskCount`, `attachmentsCount`, `notesCount`, `favorite`, `pinned`, `cover` (boolean — cover images are CSS gradients built from the project's own color via `color-mix()`, not external image files).

**Sort options (9, all real comparators):** Recently updated (default), Recently created, Newest, Oldest, Deadline, Alphabetical, Progress, Priority, Most active. (Note: "Newest" and "Recently created" are both `createdAt` descending — the spec listed them as two separate options, so both exist as labels even though they produce identical ordering.)

**Filters:** search text, status, priority, tags, favorites-only, show-archived (archived projects are hidden by default — a deliberate, stated default, not a silent one).

---

## 6. Accessibility

Skip-to-content link · `:focus-visible` rings everywhere (not `:focus`, so mouse users don't see rings on click) · global `prefers-reduced-motion` override that zeroes every animation/transition · real ARIA: `role="dialog" aria-modal="true"` on the command palette and the project detail panel, a genuine `combobox`/`listbox` pattern on the command palette (not a lookalike — `aria-expanded`, `aria-controls`, `aria-autocomplete`, `aria-activedescendant`), `role="checkbox" aria-checked` on the custom task/habit toggles, `aria-current="page"` on the active nav link, `aria-haspopup`/`aria-expanded` on every dropdown trigger · focus management: command palette and detail panel both save and restore focus on open/close; the mobile drawer moves focus to its first link on open and back to the hamburger on close · full keyboard support: Escape closes any open overlay, arrow keys navigate the command palette and sort menu, Enter/Space activate the custom checkbox controls.

---

## 7. Validation methodology (used at the end of every milestone)

Every JS file syntax-checked as a real ES module (`node --check` via stdin, not just as a script). Every `import { x }` cross-referenced against the actual `export` list of its target file, including path resolution across the `projects/` subfolder. Every dynamic `import()` target confirmed to exist. Every `getElementById` call cross-referenced against every id that exists anywhere — including ids that JS itself generates via template strings, not just the two static HTML files. Every CSS class used in JS cross-referenced against actual CSS rules. Every `var(--x)` used anywhere cross-referenced against `tokens.css` definitions. Both HTML files parsed for tag balance.

**Real bugs this caught, not hypothetical ones:** a dead `--space-20` CSS fallback, a missing `.quick-action__label` rule, a missing `.badge--planning`/`.badge--archived` pair, and — the most substantive one — a stale-cache bug where archiving a project while "show archived" was off wouldn't have actually removed it from the grid.

---

## 8. What's deliberately deferred (and why)

- **List and Kanban views + drag-and-drop.** The toolbar's view-switcher shows them as `disabled` with a tooltip, not clickable-but-broken. Kanban specifically still needs a decision about where Not Started/Blocked/Archived projects live, since the brief's 4 Kanban columns (Planning/In Progress/Review/Done) don't cover all 7 statuses.
- **Actually creating or editing a project** (`ProjectModal`/`ProjectForm`). No backend exists to persist one, so "New Project" opens the command palette instead of a fake or dead button.
- **Import/Export.** Needs real file I/O; not stubbed.
- **Deadline-range, completion%, owner, member, and color filters.** Status/priority/tags/favorites/archived are built; these five are not yet.
- **Keyboard shortcuts and right-click context menus specific to Projects.**

---

## 9. Known limitations

- Everything is in-memory. Reloading the page resets task/habit checkbox toggles and any Projects-module edits (favorite/pin/archive) back to the seed data — only theme, workspace selection, and sidebar-collapsed state persist, via `localStorage`.
- ES module scripts don't execute over `file://` in Chrome (a browser restriction, not a bug here) — local preview needs `python3 -m http.server`, not double-clicking the file. Doesn't affect GitHub Pages, which serves over real HTTPS.
- The dashboard and Projects module now share one dataset, but nothing else (Notes, Calendar, Habits as their own pages) exists yet — those 9 sidebar sections are still the honest empty-state placeholders from the very first milestone, each tagged with its Foundation §10 roadmap phase where one exists.
