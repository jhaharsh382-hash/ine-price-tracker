
function ts() {
  return new Date().toISOString();
}

module.exports = {
  info: (msg, meta = {}) => console.log(`[${ts()}] INFO  ${msg}`, Object.keys(meta).length ? meta : ''),
  warn: (msg, meta = {}) => console.warn(`[${ts()}] WARN  ${msg}`, Object.keys(meta).length ? meta : ''),
  error: (msg, meta = {}) => console.error(`[${ts()}] ERROR ${msg}`, Object.keys(meta).length ? meta : ''),
};
