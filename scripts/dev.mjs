import { spawn } from "node:child_process";

const developmentSecret = "local-development-secret-change-this-before-deploying";
const processes = [
  {
    name: "web",
    command: process.execPath,
    args: ["node_modules/next/dist/bin/next", "dev"],
    env: { ...process.env, NEXT_PUBLIC_ALLOW_DEV_MODE: "true" },
  },
  {
    name: "api",
    command: process.execPath,
    args: ["server/src/server.js"],
    env: {
      ...process.env,
      ALLOW_DEV_MODE: "true",
      JWT_SECRET: process.env.JWT_SECRET || developmentSecret,
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
