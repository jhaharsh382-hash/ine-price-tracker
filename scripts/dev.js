const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const backend = spawn(process.execPath, ['src/server.js'], {
  cwd: path.join(root, 'backend'),
  env: { ...process.env, PORT: '0' },
  stdio: ['inherit', 'pipe', 'pipe'],
});

let frontend;
let backendReady = false;

function forward(prefix, stream) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(`[${prefix}] ${text}`);

    if (!backendReady) {
      const match = text.match(/listening on :(\d+)/);
      if (match) {
        backendReady = true;
        startFrontend(Number(match[1]));
      }
    }
  });
}

function startFrontend(backendPort) {
  frontend = spawn(process.execPath, [
    path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host',
    '0.0.0.0',
  ], {
    cwd: path.join(root, 'frontend'),
    env: {
      ...process.env,
      FRONTEND_PORT: '0',
      VITE_API_BASE_URL: `http://localhost:${backendPort}`,
    },
    stdio: 'inherit',
  });
}

forward('backend', backend.stdout);
forward('backend', backend.stderr);

function shutdown() {
  if (frontend && !frontend.killed) frontend.kill();
  if (!backend.killed) backend.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
backend.on('exit', (code) => {
  if (frontend && !frontend.killed) frontend.kill();
  process.exit(code || 0);
});