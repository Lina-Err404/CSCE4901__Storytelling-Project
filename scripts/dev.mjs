import { spawn } from "node:child_process";

const processes = [
  {
    name: "web",
    command: process.execPath,
    args: ["node_modules/next/dist/bin/next", "dev"],
    env: process.env,
  },
  {
    name: "firestore",
    command: process.execPath,
    args: [
      "server/node_modules/firebase-tools/lib/bin/firebase.js",
      "emulators:start",
      "--only",
      "firestore",
      "--project",
      "demo-storytelling",
    ],
    env: process.env,
  },
  {
    name: "api",
    command: process.execPath,
    args: ["server/src/server.js"],
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST:
        process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
      JWT_SECRET:
        process.env.JWT_SECRET ||
        "local-development-secret-change-this-before-deploying",
    },
  },
];

let shuttingDown = false;
const children = processes.map(({ name, command, args, env }) => {
  const child = spawn(command, args, { env, stdio: "inherit" });
  child.on("error", (error) => {
    console.error(`[${name}] ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[${name}] exited with code ${code ?? 1}`);
      shutdown(code || 1);
    }
  });
  return child;
});

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  process.exitCode = code;
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());