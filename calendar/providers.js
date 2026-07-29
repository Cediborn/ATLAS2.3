// Atlas Calendar — Sync provider architecture.
//
// This is the seam the brief asks for ("eventually support Google Calendar
// syncing, Outlook syncing"), built as an interface today rather than faked
// API calls. Atlas has no backend and no OAuth flow (per the README), so a
// provider that pretended `connect()` succeeded would be lying to the UI —
// worse than not having the feature. LocalProvider is fully real: it's what
// every event in this module already runs on. GoogleProvider/OutlookProvider
// document the exact same shape so a future implementation is a drop-in,
// not a rewrite.
//
// Every provider implements:
//   id, name
//   isConnected()                          -> boolean
//   connect()                              -> Promise<boolean>
//   disconnect()                           -> Promise<void>
//   pull(rangeStartISO, rangeEndISO)       -> Promise<CalendarEvent[]>
//   push(event)                            -> Promise<CalendarEvent>  (create/update)
//   remove(eventId)                        -> Promise<void>
//
// `rescheduleEvent`/`addEvent`/etc. in state.js call `push` on the event's
// `sourceProvider` after mutating local state — today that's always
// LocalProvider (a no-op passthrough), so wiring a real provider later means
// implementing these six methods, not touching state.js or any view.

export const LocalProvider = {
  id: 'local',
  name: 'Atlas (this device)',
  isConnected: () => true,
  async connect() { return true; },
  async disconnect() {},
  async pull() { return []; }, // native events already live in data.js; nothing to pull
  async push(event) { return event; },
  async remove() {},
};

function notImplemented(providerName, method) {
  return async () => {
    throw new Error(`${providerName}.${method}() is not implemented yet — connecting requires a real OAuth flow and backend, which Atlas doesn't have (see README). This call is a safe no-op stub, not a faked success.`);
  };
}

export const GoogleProvider = {
  id: 'google',
  name: 'Google Calendar',
  isConnected: () => false,
  connect: notImplemented('GoogleProvider', 'connect'),
  disconnect: notImplemented('GoogleProvider', 'disconnect'),
  pull: notImplemented('GoogleProvider', 'pull'),
  push: notImplemented('GoogleProvider', 'push'),
  remove: notImplemented('GoogleProvider', 'remove'),
};

export const OutlookProvider = {
  id: 'outlook',
  name: 'Outlook Calendar',
  isConnected: () => false,
  connect: notImplemented('OutlookProvider', 'connect'),
  disconnect: notImplemented('OutlookProvider', 'disconnect'),
  pull: notImplemented('OutlookProvider', 'pull'),
  push: notImplemented('OutlookProvider', 'push'),
  remove: notImplemented('OutlookProvider', 'remove'),
};

export const PROVIDERS = [LocalProvider, GoogleProvider, OutlookProvider];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || LocalProvider;
}
