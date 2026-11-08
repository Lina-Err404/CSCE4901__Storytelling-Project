import { spawn } from 'node:child_process';

const processes = [
  { name: 'web', command: process.execPath, args: ['node_modules/next/dist/bin/next', 'dev'] },
  { name: 'api', command: process.execPath, args: ['server/src/server.js'] },
];
let shuttingDown = false;
const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, { env: process.env, stdio: 'inherit' });
  child.on('error', (error) => { console.error(`[${name}] ${error.message}`); shutdown(1); });
  child.on('exit', (code) => {
    if (!shuttingDown) { console.error(`[${name}] exited (${code ?? 1})`); shutdown(code || 1); }
  });
  return child;
});
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}
process.once('SIGINT', () => shutdown());
process.once('SIGTERM', () => shutdown());
