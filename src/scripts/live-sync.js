const CHANNEL_NAME = "berzan-live-sync-v1";
const STORAGE_KEY = "berzan_live_sync_ping_v1";
const SOURCE_ID =
  globalThis.crypto?.randomUUID?.() ||
  `sync_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

const listeners = new Set();
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

function normalizePayload(payload = {}) {
  return {
    sourceId: payload.sourceId || SOURCE_ID,
    type: payload.type || "refresh",
    scope: payload.scope || "all",
    at: payload.at || Date.now(),
    detail: payload.detail || {},
  };
}

function publishToListeners(payload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error("[BERZAN sync] listener failed", error);
    }
  });
}

function handleIncoming(raw) {
  const payload = normalizePayload(raw);
  if (payload.sourceId === SOURCE_ID) return;
  publishToListeners(payload);
}

if (channel) {
  channel.addEventListener("message", (event) => handleIncoming(event.data));
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      handleIncoming(JSON.parse(event.newValue));
    } catch {}
  });
}

export function emitAppSync(type = "refresh", scope = "all", detail = {}) {
  const payload = normalizePayload({ type, scope, detail });
  publishToListeners(payload);
  try {
    channel?.postMessage(payload);
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  return payload;
}

export function subscribeAppSync(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAppSyncSourceId() {
  return SOURCE_ID;
}
