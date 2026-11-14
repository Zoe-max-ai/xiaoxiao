const listeners = {};

export function on(event, handler) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(handler);
}

export function off(event, handler) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter(h => h !== handler);
}

export function emit(event, detail) {
  if (!listeners[event]) return;
  listeners[event].forEach(h => {
    try { h(detail); } catch (e) { console.error(e); }
  });
}