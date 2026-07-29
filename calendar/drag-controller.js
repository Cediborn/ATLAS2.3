// Atlas Calendar — Reusable drag-to-reschedule controller.
//
// Pointer Events rather than HTML5 drag-and-drop: native DnD's ghost-image
// API is clunky to theme and drag-and-drop touch support is inconsistent,
// while pointerdown/move/up works identically with mouse, pen, and touch.
//
// This file knows nothing about Month/Week/Day layout — the caller supplies
// `snap(clientX, clientY)` appropriate to its own grid (day-cell snapping
// for Month, 15-minute slot snapping for Week/Day). `onDrop` is the only
// exit point that touches state; that's deliberately also where a real
// provider.push(event) call would go once a backend exists (see
// providers.js) — no rewrite needed, just an additional call in that one
// function.

export function initDragController({ root, snap, onDragStart, onDragMove, onDrop, isDraggable }) {
  let drag = null;

  function handlePointerDown(e) {
    if (e.button !== 0) return;
    const handle = e.target.closest('[data-cal-event][data-draggable="true"]');
    if (!handle) return;
    if (isDraggable && !isDraggable(handle.dataset.eventId)) return;

    const startRect = handle.getBoundingClientRect();
    drag = {
      eventId: handle.dataset.eventId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originRect: startRect,
      sourceEl: handle,
      moved: false,
      lastTarget: null,
    };

    handle.addEventListener('pointermove', handlePointerMove);
    handle.addEventListener('pointerup', handlePointerUp, { once: true });
    handle.addEventListener('pointercancel', handlePointerCancel, { once: true });
    try { handle.setPointerCapture(e.pointerId); } catch { /* not all targets support capture */ }
  }

  function handlePointerMove(e) {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.startX) < 4 && Math.abs(e.clientY - drag.startY) < 4) return; // ignore jitter so a plain click still opens the popover
      drag.moved = true;
      drag.sourceEl.classList.add('is-dragging');
      onDragStart?.(drag.eventId);
    }
    const target = snap(e.clientX, e.clientY);
    if (target) {
      drag.lastTarget = target;
      onDragMove?.(drag.eventId, target);
    }
  }

  function finish(commit) {
    if (!drag) return;
    const { sourceEl, eventId, lastTarget, moved } = drag;
    sourceEl.removeEventListener('pointermove', handlePointerMove);
    sourceEl.classList.remove('is-dragging');
    drag = null;
    if (moved) {
      if (commit && lastTarget) onDrop?.(eventId, lastTarget.start, lastTarget.end);
      else onDrop?.(eventId, null, null); // caller interprets null/null as "cancelled, just re-render"
    }
  }

  function handlePointerUp() { finish(true); }
  function handlePointerCancel() { finish(false); }

  root.addEventListener('pointerdown', handlePointerDown);
  return { destroy() { root.removeEventListener('pointerdown', handlePointerDown); } };
}
