import type { ServiceLogEntry } from '../types';

/**
 * Parse a log string from the Rust backend into a structured ServiceLogEntry.
 *
 * Backend format examples:
 *   "[2026-08-05 10:30:00] some info message"
 *   "[2026-08-05 10:30:00] ERROR: some error message"
 *   "[2026-08-05 10:30:00] SYSTEM ERROR: some system error"
 */
export function parseLogString(raw: string): ServiceLogEntry {
  // Try to match the [timestamp] prefix
  const match = raw.match(/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s*(.*)$/);

  if (!match) {
    // Fallback: treat the whole string as an info message
    return {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: raw,
    };
  }

  const [, timestampStr, rest] = match;
  // Convert "2026-08-05 10:30:00" to ISO string
  const timestamp = timestampStr.replace(' ', 'T') + '+08:00';

  // Detect level from prefix
  let level: ServiceLogEntry['level'] = 'info';
  let message = rest;

  if (rest.startsWith('ERROR:') || rest.startsWith('SYSTEM ERROR:')) {
    level = 'error';
    message = rest.replace(/^(SYSTEM\s+)?ERROR:\s*/, '');
  } else if (rest.startsWith('WARN:')) {
    level = 'warn';
    message = rest.replace(/^WARN:\s*/, '');
  } else if (rest.startsWith('DEBUG:')) {
    level = 'debug';
    message = rest.replace(/^DEBUG:\s*/, '');
  }

  return { timestamp, level, message };
}

/**
 * Parse an array of raw log strings from the backend.
 */
export function parseLogStrings(rawLogs: string[]): ServiceLogEntry[] {
  return rawLogs.map(parseLogString);
}
