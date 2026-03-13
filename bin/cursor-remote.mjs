#!/usr/bin/env node

import { spawn, execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { networkInterfaces } from "os";
import { existsSync } from "fs";
import qrcode from "qrcode-terminal";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("-"));
const positional = args.filter((a) => !a.startsWith("-"));

if (flags.includes("--help") || flags.includes("-h")) {
  console.log(`
  cursor-remote - Control Cursor IDE from any device on your network

  Usage:
    cr [workspace] [options]

  Arguments:
    workspace    Path to your project folder (defaults to current directory)

  Options:
    -p, --port   Port to run on (default: 3000)
    --no-open    Don't auto-open the browser
    --no-qr      Don't show QR code in terminal
    -h, --help   Show this help

  Examples:
    cr                          # Start in current folder
    cr ~/projects/my-app        # Start for a specific project
    cr . --port 8080            # Use a different port
`);
  process.exit(0);
}

const workspace = positional[0] ? resolve(positional[0]) : process.cwd();
const portIdx = flags.indexOf("--port") !== -1 ? flags.indexOf("--port") : flags.indexOf("-p");
const port = portIdx !== -1 && args[args.indexOf(flags[portIdx]) + 1]
  ? args[args.indexOf(flags[portIdx]) + 1]
  : process.env.PORT || "3000";
const noOpen = flags.includes("--no-open");
const noQr = flags.includes("--no-qr");

if (!existsSync(workspace)) {
  console.error(`  Error: workspace path does not exist: ${workspace}`);
  process.exit(1);
}

function getLanIp() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

const lanIp = getLanIp();
const localUrl = `http://localhost:${port}`;
const networkUrl = lanIp ? `http://${lanIp}:${port}` : null;

try {
  const logo = execSync("npx oh-my-logo@latest \"cursor\\nremote\" nebula --filled --block-font block --color", { stdio: ["ignore", "pipe", "ignore"] });
  process.stdout.write(logo);
} catch {
  // fallback if oh-my-logo is unavailable
  process.stdout.write("\x1b[36m  cursor remote\x1b[0m\n\n");
}
console.log(`  \x1b[2mWorkspace:\x1b[0m  ${workspace}`);
console.log(`  \x1b[2mLocal:\x1b[0m      ${localUrl}`);
if (networkUrl) {
  console.log(`  \x1b[2mNetwork:\x1b[0m    \x1b[36m${networkUrl}\x1b[0m`);
}
console.log("");

if (!noQr && networkUrl) {
  console.log("  \x1b[2mScan to connect from your phone:\x1b[0m");
  console.log("");
  qrcode.generate(networkUrl, { small: true }, (code) => {
    const indented = code.split("\n").map((l) => "    " + l).join("\n");
    console.log(indented);
    console.log("");
    console.log("  \x1b[2mPress Ctrl+C to stop\x1b[0m");
    console.log("");
  });
}

if (!noOpen) {
  try {
    const openCmd = process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
    setTimeout(() => {
      execSync(`${openCmd} ${localUrl}`, { stdio: "ignore" });
    }, 2000);
  } catch {
    // silently fail if browser can't open
  }
}

const child = spawn("npx", ["next", "dev", "--hostname", "0.0.0.0", "--port", port], {
  cwd: projectRoot,
  stdio: ["inherit", "pipe", "pipe"],
  env: {
    ...process.env,
    CURSOR_WORKSPACE: workspace,
    PORT: port,
  },
  shell: true,
});

child.stdout.on("data", () => {
  // suppress Next.js output to keep our clean display
});

child.stderr.on("data", (data) => {
  const text = data.toString();
  if (text.includes("Error") || text.includes("error")) {
    process.stderr.write("  " + text);
  }
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});
