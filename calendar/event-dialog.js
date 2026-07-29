// Atlas Calendar — EventDialog. A centered modal (not a full-screen
// takeover like the Notes editor) since a form this size doesn't need one —
// matches how Cron/Notion Calendar handle event creation.

import { icon } from '../icons.js';
import {
  CALENDARS, CALENDAR_COLORS, PRIORITIES, EVENT_TYPES, EVENT_TYPE_CONFIG,
  REMINDER_OPTIONS, RECURRENCE_FREQUENCIES, CUSTOM_RECURRENCE_UNITS, createBlankEvent, createEventId,
} from './data.js';
import { previewOccurrences, describeRecurrence } from './recurrence.js';
import { pad2 } from '../date-utils.js';

let els = {};
let mode = 'create';
let draft = null;
let onSaveCb = null;
let onDeleteCb = null;
let lastFocused = null;

function splitDateTime(iso, allDay) {
  if (allDay) return { date: iso, time: '09:00' };
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
}
function joinDateTime(date, time) {
  return `${date}T${time}:00`;
}

export function initEventDialog(root, { onSave, onDelete } = {}) {
  onSaveCb = onSave;
  onDeleteCb = onDelete;
  root.insertAdjacentHTML('beforeend', dialogMarkup());
  cacheEls();
  wireEvents();
}

function dialogMarkup() {
  return `
    <div class="overlay cal-dialog-overlay" id="cal-dialog-overlay" hidden>
      <div class="cal-dialog" role="dialog" aria-modal="true" aria-labelledby="cal-dialog-heading">
        <header class="cal-dialog__header">
          <h2 id="cal-dialog-heading">New Event</h2>
          <button type="button" class="icon-btn" id="cal-dialog-close" aria-label="Close">${icon('x', { size: 18 })}</button>
        </header>

        <div class="cal-dialog__body">
          <div class="field">
            <label for="cal-f-title">Title</label>
            <input type="text" id="cal-f-title" placeholder="Add a title" aria-describedby="cal-f-title-error" />
            <span class="cal-field-error" id="cal-f-title-error" role="alert"></span>
          </div>

          <div class="field">
            <label for="cal-f-description">Description</label>
            <textarea id="cal-f-description" rows="2" placeholder="Optional details\u2026"></textarea>
          </div>

          <div class="cal-dialog__row">
            <div class="field cal-field--grow">
              <label for="cal-f-date">Date</label>
              <input type="date" id="cal-f-date" />
            </div>
            <label class="filter-checkbox cal-dialog__allday">
              <input type="checkbox" id="cal-f-allday" />
              <span>All day</span>
            </label>
          </div>

          <div class="cal-dialog__row" id="cal-f-time-row">
            <div class="field cal-field--grow">
              <label for="cal-f-start">Start time</label>
              <input type="time" id="cal-f-start" />
            </div>
            <div class="field cal-field--grow">
              <label for="cal-f-end">End time</label>
              <input type="time" id="cal-f-end" aria-describedby="cal-f-end-error" />
            </div>
          </div>
          <span class="cal-field-error" id="cal-f-end-error" role="alert"></span>

          <div class="cal-dialog__row">
            <div class="field cal-field--grow">
              <label for="cal-f-calendar">Calendar</label>
              <select id="cal-f-calendar">
                ${CALENDARS.filter((c) => !c.readOnly).map((c) => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="field cal-field--grow">
              <label for="cal-f-type">Type</label>
              <select id="cal-f-type">
                ${EVENT_TYPES.map((t) => `<option value="${t}">${EVENT_TYPE_CONFIG[t].label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="cal-dialog__row">
            <div class="field cal-field--grow">
              <label for="cal-f-priority">Priority</label>
              <select id="cal-f-priority">
                ${PRIORITIES.map((p) => `<option value="${p}">${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}
              </select>
            </div>
            <div class="field cal-field--grow">
              <label for="cal-f-color">Color</label>
              <select id="cal-f-color">
                <option value="">Inherit from calendar</option>
                ${CALENDAR_COLORS.map((c) => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="field">
            <label for="cal-f-location">Location</label>
            <input type="text" id="cal-f-location" placeholder="Optional" />
          </div>

          <div class="field">
            <label class="filter-checkbox">
              <input type="checkbox" id="cal-f-recurring" />
              <span>Recurring</span>
            </label>
          </div>

          <div class="cal-recurrence-panel" id="cal-recurrence-panel" hidden>
            <div class="cal-dialog__row">
              <div class="field cal-field--grow">
                <label for="cal-f-freq">Repeats</label>
                <select id="cal-f-freq">
                  ${RECURRENCE_FREQUENCIES.map((f) => `<option value="${f.id}">${f.label}</option>`).join('')}
                </select>
              </div>
              <div class="field cal-field--grow" id="cal-f-custom-row" hidden>
                <label for="cal-f-custom-interval">Every</label>
                <div class="cal-dialog__row" style="gap:8px">
                  <input type="number" id="cal-f-custom-interval" min="1" value="1" style="width:64px" />
                  <select id="cal-f-custom-unit">
                    ${CUSTOM_RECURRENCE_UNITS.map((u) => `<option value="${u.id}">${u.label}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>

            <div class="cal-dialog__row" role="radiogroup" aria-label="Ends">
              <label class="filter-checkbox"><input type="radio" name="cal-ends" value="never" checked /><span>Never ends</span></label>
              <label class="filter-checkbox"><input type="radio" name="cal-ends" value="on" /><span>On date</span></label>
              <input type="date" id="cal-f-until" disabled />
              <label class="filter-checkbox"><input type="radio" name="cal-ends" value="after" /><span>After</span></label>
              <input type="number" id="cal-f-count" min="1" value="10" style="width:64px" disabled />
            </div>
            <span class="cal-field-error" id="cal-f-until-error" role="alert"></span>

            <p class="cal-recurrence-preview" id="cal-recurrence-preview"></p>
          </div>

          <div class="field">
            <label for="cal-f-reminder">Reminder</label>
            <select id="cal-f-reminder">
              ${REMINDER_OPTIONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('')}
            </select>
          </div>

          <div class="field">
            <label for="cal-f-notes">Notes</label>
            <textarea id="cal-f-notes" rows="2" placeholder="Optional"></textarea>
          </div>
        </div>

        <footer class="cal-dialog__footer">
          <button type="button" class="btn cal-dialog__delete" id="cal-dialog-delete" hidden>${icon('archive', { size: 16 })}<span>Delete</span></button>
          <span class="cal-dialog__footer-spacer"></span>
          <button type="button" class="btn btn--secondary" id="cal-dialog-cancel">Cancel</button>
          <button type="button" class="btn btn--primary" id="cal-dialog-save">Save</button>
        </footer>
      </div>
    </div>`;
}

function cacheEls() {
  const byId = (id) => document.getElementById(id);
  els = {
    overlay: byId('cal-dialog-overlay'), heading: byId('cal-dialog-heading'), close: byId('cal-dialog-close'),
    title: byId('cal-f-title'), titleError: byId('cal-f-title-error'), description: byId('cal-f-description'),
    date: byId('cal-f-date'), allDay: byId('cal-f-allday'), timeRow: byId('cal-f-time-row'),
    start: byId('cal-f-start'), end: byId('cal-f-end'), endError: byId('cal-f-end-error'),
    calendar: byId('cal-f-calendar'), type: byId('cal-f-type'), priority: byId('cal-f-priority'), color: byId('cal-f-color'),
    location: byId('cal-f-location'), recurring: byId('cal-f-recurring'), recurrencePanel: byId('cal-recurrence-panel'),
    freq: byId('cal-f-freq'), customRow: byId('cal-f-custom-row'), customInterval: byId('cal-f-custom-interval'), customUnit: byId('cal-f-custom-unit'),
    until: byId('cal-f-until'), count: byId('cal-f-count'), untilError: byId('cal-f-until-error'), preview: byId('cal-recurrence-preview'),
    reminder: byId('cal-f-reminder'), notes: byId('cal-f-notes'),
    delete: byId('cal-dialog-delete'), cancel: byId('cal-dialog-cancel'), save: byId('cal-dialog-save'),
  };
}

function wireEvents() {
  els.close.addEventListener('click', closeDialog);
  els.cancel.addEventListener('click', closeDialog);
  els.overlay.addEventListener('click', (e) => { if (e.target === els.overlay) closeDialog(); });
  document.addEventListener('keydown', (e) => {
    if (els.overlay.hidden) return;
    if (e.key === 'Escape') closeDialog();
  });

  els.allDay.addEventListener('change', () => { els.timeRow.hidden = els.allDay.checked; });
  els.recurring.addEventListener('change', () => {
    els.recurrencePanel.hidden = !els.recurring.checked;
    if (els.recurring.checked) updatePreview();
  });
  els.freq.addEventListener('change', () => {
    els.customRow.hidden = els.freq.value !== 'custom';
    updatePreview();
  });
  [els.customInterval, els.customUnit, els.date].forEach((el) => el.addEventListener('input', updatePreview));

  document.querySelectorAll('input[name="cal-ends"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      els.until.disabled = radio.value !== 'on' || !radio.checked;
      els.count.disabled = radio.value !== 'after' || !radio.checked;
      if (radio.checked) {
        els.until.disabled = radio.value !== 'on';
        els.count.disabled = radio.value !== 'after';
      }
      updatePreview();
    });
  });
  els.until.addEventListener('input', updatePreview);
  els.count.addEventListener('input', updatePreview);

  els.save.addEventListener('click', handleSave);
  els.delete.addEventListener('click', () => {
    if (draft?.id) onDeleteCb?.(draft.id);
    closeDialog();
  });
}

function buildRuleFromForm() {
  if (!els.recurring.checked) return null;
  const freq = els.freq.value;
  const rule = { freq, interval: freq === 'custom' ? Number(els.customInterval.value) || 1 : 1, unit: freq === 'custom' ? els.customUnit.value : undefined, count: null, until: null };
  const endsMode = document.querySelector('input[name="cal-ends"]:checked')?.value;
  if (endsMode === 'on' && els.until.value) rule.until = els.until.value;
  else if (endsMode === 'after' && els.count.value) rule.count = Number(els.count.value);
  return rule;
}

function updatePreview() {
  const rule = buildRuleFromForm();
  if (!rule || !els.date.value) { els.preview.textContent = ''; return; }
  const dates = previewOccurrences(rule, els.date.value, 4);
  const list = dates.map((d) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)).join(', ');
  els.preview.textContent = `${describeRecurrence(rule)} \u2014 next: ${list}${dates.length === 4 ? '\u2026' : ''}`;
}

function clearErrors() {
  els.titleError.textContent = '';
  els.endError.textContent = '';
  els.untilError.textContent = '';
  els.title.setAttribute('aria-invalid', 'false');
  els.end.setAttribute('aria-invalid', 'false');
}

function validate() {
  clearErrors();
  let valid = true;

  if (!els.title.value.trim()) {
    els.titleError.textContent = 'Title is required.';
    els.title.setAttribute('aria-invalid', 'true');
    valid = false;
  }
  if (!els.allDay.checked && els.end.value && els.start.value && els.end.value <= els.start.value) {
    els.endError.textContent = 'End time must be after start time.';
    els.end.setAttribute('aria-invalid', 'true');
    valid = false;
  }
  if (els.recurring.checked) {
    const endsMode = document.querySelector('input[name="cal-ends"]:checked')?.value;
    if (endsMode === 'on' && els.until.value && els.until.value < els.date.value) {
      els.untilError.textContent = 'End date must be on or after the start date.';
      valid = false;
    }
  }
  return valid;
}

function handleSave() {
  if (!validate()) return;

  const allDay = els.allDay.checked;
  const start = allDay ? els.date.value : joinDateTime(els.date.value, els.start.value);
  const end = allDay ? els.date.value : joinDateTime(els.date.value, els.end.value);
  const reminderVal = els.reminder.value;

  const payload = {
    ...draft,
    title: els.title.value.trim(),
    description: els.description.value.trim(),
    start, end, allDay,
    calendarId: els.calendar.value,
    color: els.color.value || null,
    type: els.type.value,
    priority: els.priority.value,
    deadline: els.type.value === 'deadline' ? true : draft.deadline,
    location: els.location.value.trim(),
    notes: els.notes.value.trim(),
    recurring: els.recurring.checked,
    recurrenceRule: buildRuleFromForm(),
    reminders: reminderVal === '' ? [] : [{ id: `r-${Date.now()}`, offsetMinutes: Number(reminderVal), method: 'notification' }],
  };

  if (mode === 'create') payload.id = createEventId();

  onSaveCb?.(payload, mode);
  closeDialog();
}

export function openEventDialog({ mode: m, event, seedDateISO }) {
  mode = m;
  draft = m === 'edit' ? { ...event } : createBlankEvent(seedDateISO || new Date().toISOString().slice(0, 10));
  lastFocused = document.activeElement;
  clearErrors();

  els.heading.textContent = m === 'edit' ? 'Edit Event' : 'New Event';
  els.delete.hidden = m !== 'edit';

  els.title.value = draft.title || '';
  els.description.value = draft.description || '';
  const { date, time: startTime } = splitDateTime(draft.start, draft.allDay);
  const { time: endTime } = splitDateTime(draft.end, draft.allDay);
  els.date.value = date;
  els.start.value = startTime;
  els.end.value = draft.allDay ? '10:00' : endTime;
  els.allDay.checked = !!draft.allDay;
  els.timeRow.hidden = !!draft.allDay;

  els.calendar.value = CALENDARS.some((c) => c.id === draft.calendarId && !c.readOnly) ? draft.calendarId : CALENDARS.find((c) => !c.readOnly).id;
  els.type.value = draft.type || 'normal';
  els.priority.value = draft.priority || 'medium';
  els.color.value = draft.color || '';
  els.location.value = draft.location || '';
  els.notes.value = draft.notes || '';

  els.recurring.checked = !!draft.recurring;
  els.recurrencePanel.hidden = !draft.recurring;
  if (draft.recurrenceRule) {
    els.freq.value = draft.recurrenceRule.freq;
    els.customRow.hidden = draft.recurrenceRule.freq !== 'custom';
    els.customInterval.value = draft.recurrenceRule.interval || 1;
    els.customUnit.value = draft.recurrenceRule.unit || 'week';
    if (draft.recurrenceRule.until) {
      document.querySelector('input[name="cal-ends"][value="on"]').checked = true;
      els.until.disabled = false;
      els.until.value = draft.recurrenceRule.until;
    } else if (draft.recurrenceRule.count) {
      document.querySelector('input[name="cal-ends"][value="after"]').checked = true;
      els.count.disabled = false;
      els.count.value = draft.recurrenceRule.count;
    } else {
      document.querySelector('input[name="cal-ends"][value="never"]').checked = true;
      els.until.disabled = true;
      els.count.disabled = true;
    }
  } else {
    els.freq.value = 'weekly';
    els.customRow.hidden = true;
    document.querySelector('input[name="cal-ends"][value="never"]').checked = true;
    els.until.disabled = true;
    els.count.disabled = true;
  }
  updatePreview();

  els.reminder.value = draft.reminders?.[0]?.offsetMinutes != null ? String(draft.reminders[0].offsetMinutes) : '';

  els.overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  els.title.focus();
}

export function closeDialog() {
  if (els.overlay.hidden) return;
  els.overlay.hidden = true;
  document.body.style.overflow = '';
  draft = null;
  lastFocused?.focus?.();
}
