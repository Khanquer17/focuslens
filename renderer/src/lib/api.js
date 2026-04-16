// Wrapper around IPC calls exposed via preload.js
// Uses a getter to handle the case where window.electron isn't available yet at import time

const api = new Proxy({}, {
  get(_, prop) {
    if (window.electron && window.electron[prop]) {
      return window.electron[prop];
    }
    // Fallback: return a function that resolves with empty data
    console.warn(`[API] ${prop} called but window.electron not available`);
    return async () => null;
  }
});

export default api;
