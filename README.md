# Cursor Remote Control

Control your Cursor IDE agent from any device on your local network. Open the web UI on your phone, tablet, or another computer and interact with Cursor's AI agent running on your machine.

Inspired by [Claude Code's Remote Control](https://code.claude.com/docs/en/remote-control), but built for Cursor and designed to work over LAN without any cloud infrastructure.

## How it works

```
Phone / Tablet / Other PC                Your Machine
       (browser)           ──── LAN ────>  Next.js  ──> Cursor CLI (agent)
                           <── stream ───  (0.0.0.0:3000)
```

1. Run `cr` in your project folder
2. A QR code appears in your terminal -- scan it from your phone
3. Send messages through the web UI, they run on Cursor's agent locally
4. See responses, tool calls (file reads, writes, shell commands) streamed in real time
5. Browse and resume all your past Cursor sessions for that project

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cursor CLI](https://cursor.com/cli) installed and authenticated (`agent login`)
- A Cursor subscription

## Install

```bash
git clone https://github.com/your-user/cursor-remote-control.git
cd cursor-remote-control
npm install
npm link   # makes `cr` available globally
```

## Usage

```bash
# Start in current folder
cr

# Start for a specific project
cr ~/projects/my-app

# Use a different port
cr --port 8080

# Skip auto-opening browser
cr --no-open
```

### Web UI

- **Send messages**: type a prompt and press Enter
- **QR code**: tap the QR icon in the top bar to show a scannable link
- **Sessions**: tap the hamburger menu to browse all past sessions (reads from Cursor's own session data)
- **Resume**: tap any past session to continue the conversation
- **Workspace**: tap the folder bar to change which project the agent works in
- **Tool calls**: file reads, writes, and shell commands appear as collapsible cards

### Sessions

The sidebar shows all your sessions for the current workspace -- both sessions started from this tool and from the Cursor IDE itself. It reads directly from Cursor's `~/.cursor/projects/` data, so everything stays in sync.

## Architecture

```
src/
  app/
    api/
      chat/route.ts         Streams Cursor CLI output to the browser
      sessions/route.ts     Merges Cursor transcripts + our session store
      info/route.ts         LAN IP, workspace, QR code data
    layout.tsx
    page.tsx
  components/               React UI components (chat, sidebar, QR modal)
  hooks/use-chat.ts         Chat state + stream consumption
  lib/
    cursor-cli.ts           Spawns `agent -p --stream-json` processes
    transcript-reader.ts    Reads ~/.cursor/projects/<key>/agent-transcripts/
    session-store.ts        Our own session tracking (JSON file)
    workspace.ts            Workspace path management
    network.ts              LAN IP detection
    types.ts                TypeScript types for CLI stream events
bin/
  cursor-remote.mjs         CLI entry point (`cr` command)
```

## Tech stack

- **Next.js 15** (App Router)
- **React 19**
- **Tailwind CSS v4**
- **Cursor CLI** headless mode (`agent -p --stream-json`)

## License

MIT
