// Atlas — Shared date helpers. Originally lived inside projects/state.js;
// extracted here once Notes needed the exact same logic, rather than having
// one feature module import internals from another.

const DAY_MS = 86400000;

function atMidnight(d) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.round((atMidnight(new Date(`${dateStr}T00:00:00`)) - atMidnight(new Date())) / DAY_MS);
}

export function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${dateStr}T00:00:00`));
}

export function timeAgo(dateStr) {
  const days = Math.round((atMidnight(new Date()) - atMidnight(new Date(`${dateStr}T00:00:00`))) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}
