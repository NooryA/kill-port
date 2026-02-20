# kill-port

Cross-platform CLI to kill process(es) listening on a TCP port. Works on Windows, macOS, and Linux.

## Install

```bash
npm i -g "@noor.ahamed/kill-port"
```

## Usage

```bash
kill-port <port> [options]
```

### Examples

```bash
kill-port --list               # List all TCP listeners
kill-port --list --filter node # List only rows whose name/port/PID matches "node"
kill-port --list --filter "/3\d{3}/"  # List only rows matching regex (e.g. ports 3xxx)
kill-port 3000                 # Kill process on port 3000 (with confirm)
kill-port 3000 8080 443        # Kill processes on multiple ports
kill-port 3000 -f              # Kill without confirmation
kill-port 3000 --dry-run       # Show what would be killed
kill-port 3000 --json          # Machine-readable output
kill-port 3000 --timeout 5000  # Wait up to 5s for port to free
```

### Options

| Option               | Short | Description                                                             |
| -------------------- | ----- | ----------------------------------------------------------------------- |
| `--list`             | `-l`  | List all TCP listeners (no port or kill)                                |
| `--filter <pattern>` |       | With `--list`: show only rows matching pattern (substring or `/regex/`) |
| `--force`            | `-f`  | Skip confirmation prompt                                                |
| `--dry-run`          | `-d`  | Show what would be killed without killing                               |
| `--verbose`          | `-v`  | Print debug info                                                        |
| `--json`             |       | Output machine-readable JSON                                            |
| `--timeout <ms>`     |       | Wait up to this many ms for port to free after kill (default: 3000)     |

### Exit codes

- `0` – Success (port was free, or processes were killed)
- `1` – Invalid port, or one or more processes could not be killed

## Programmatic use

```js
const { findListeners, killListeners, isPortFree } = require("@noor.ahamed/kill-port");

const listeners = await findListeners(3000);
if (listeners.length > 0) {
  const result = await killListeners(listeners, { port: 3000 });
  console.log("Killed:", result.killed, "Errors:", result.errors);
}
const free = await isPortFree(3000, 5000);
```

## Troubleshooting

### lsof not found (macOS / Linux)

On minimal Linux images `lsof` may not be installed. Install it (e.g. `apt install lsof` or `yum install lsof`). The tool will try `ss` and then `netstat` as fallbacks.

### Permission denied

Listing or killing processes on certain ports may require elevated privileges. On Windows, run the terminal as Administrator if needed. On macOS/Linux, use `sudo` if necessary (e.g. `sudo kill-port 80`).

### Port already in use after kill

Use `--timeout` to wait longer for the port to be released (e.g. `kill-port 3000 --timeout 10000`).

## Uninstall

```bash
npm uninstall -g @noor.ahamed/kill-port
```

## Limitations and safety

- Do not kill system or protected processes without understanding the impact. Some PIDs may require an elevated shell (Administrator / root).
- On Windows, killing a process tree (`/T`) may close child processes.
- Output parsing depends on localized commands (`netstat`, `lsof`, `ss`); non-English locales may need testing.
