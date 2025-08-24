// js/export.worker.client.js
let _worker;
export function getExportWorker() {
  if (typeof Worker === 'undefined') return null;
  if (!_worker) {
    _worker = new Worker(new URL('./export.worker.js', import.meta.url));
  }
  return _worker;
}

export function exportViaWorker({ type, scripts }) {
  return new Promise((resolve, reject) => {
    const w = getExportWorker();
    if (!w) return reject(new Error('Worker not supported'));
    const onMessage = (ev) => {
      const { ok, blobUrl, error, mime } = ev.data || {};
      w.removeEventListener('message', onMessage);
      if (!ok) return reject(new Error(error || 'Worker export failed'));
      resolve({ blobUrl, mime });
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ type, payload: scripts });
  });
}
