/* eslint-disable no-control-regex -- strip ESC/BEL-based ANSI sequences */
/** Remove CSI / OSC sequences so CLI output can be parsed as plain text (cursor agent uses TTY control codes even when stdout is piped). */
export function stripAnsi(s: string): string {
  return s
    .replace(/\u001b\[[\d;?]*[A-Za-z]/g, "")
    .replace(/\u009b\[[\d;?]*[A-Za-z]/g, "")
    .replace(/\u001b\][\d;]*(?:[^\u0007\u001b]*)\u0007/g, "");
}
