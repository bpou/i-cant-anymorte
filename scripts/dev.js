const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectRoot = path.join(__dirname, "..");
const isWindows = process.platform === "win32";
const caddyDir = path.join(projectRoot, "caddy");

const nextExecutable = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  isWindows ? "next.cmd" : "next",
);
const caddyExecutable = path.join(
  caddyDir,
  isWindows ? "caddy_windows_amd64.exe" : "caddy",
);
const caddyConfig = path.join(caddyDir, "caddyfile");

function ensureExecutableExists(executablePath, label) {
  if (!fs.existsSync(executablePath)) {
    console.error(
      `[dev] Could not find ${label} executable at ${executablePath}.`,
    );
    process.exit(1);
  }
}

ensureExecutableExists(nextExecutable, "Next.js");
ensureExecutableExists(caddyExecutable, "Caddy");
ensureExecutableExists(caddyConfig, "Caddy configuration");

const processes = [];
let shuttingDown = false;
let caddyProcess;
let nextProcess;

function registerProcess(child) {
  processes.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (child === nextProcess) {
      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      console.log(`[dev] Next.js process exited (${reason}), shutting down.`);
      shutdown(code ?? 0);
    } else if (child === caddyProcess) {
      const reason = signal ? `signal ${signal}` : `code ${code ?? "null"}`;
      console.error(`[dev] Caddy process exited unexpectedly (${reason}).`);
      shutdown(code === 0 ? 1 : code ?? 1);
    }
  });
}

function terminate(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Ignore kill errors; process might have already stopped.
  }
}

function hardTerminate(child) {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  try {
    child.kill("SIGKILL");
  } catch {
    // On Windows SIGKILL maps to taskkill; ignore failures.
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  processes.forEach(terminate);

  setTimeout(() => {
    processes.forEach(hardTerminate);
    process.exit(exitCode);
  }, 1500);
}

function startProcess(label, command, args, options = {}) {
  const spawnOptions = {
    stdio: "inherit",
    ...options,
  };

  let finalCommand = command;
  let finalArgs = args;

  if (isWindows && path.extname(command).toLowerCase() === ".cmd") {
    finalCommand = process.env.ComSpec || "cmd.exe";
    finalArgs = ["/c", command, ...args];
  }

  try {
    const child = spawn(finalCommand, finalArgs, spawnOptions);
    child.on("error", (error) => {
      console.error(`[dev] ${label} error: ${error.message}`);
      shutdown(1);
    });
    return child;
  } catch (error) {
    console.error(`[dev] Failed to start ${label}: ${error.message}`);
    shutdown(1);
    return null;
  }
}

caddyProcess = startProcess(
  "Caddy",
  caddyExecutable,
  ["run", "--config", caddyConfig],
  {
    cwd: caddyDir,
  },
);

if (!caddyProcess) {
  process.exit(1);
}

registerProcess(caddyProcess);

nextProcess = startProcess(
  "Next.js",
  nextExecutable,
  ["dev", "--turbopack"],
  {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    cwd: projectRoot,
  },
);

if (!nextProcess) {
  process.exit(1);
}

registerProcess(nextProcess);

function handleSignal(signal) {
  return () => {
    console.log(`[dev] Received ${signal}, shutting down.`);
    shutdown(0);
  };
}

process.on("SIGINT", handleSignal("SIGINT"));
process.on("SIGTERM", handleSignal("SIGTERM"));
process.on("SIGBREAK", handleSignal("SIGBREAK"));
process.on("exit", () => shutdown(0));
