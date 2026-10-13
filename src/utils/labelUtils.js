/**
 * Human-readable labels for work location / leave-type codes.
 * Prefer "Work From Home" (or "WFH" when compact) instead of FROM_HOME / WORK_FROM_HOME.
 */

const WFH_CODES = new Set([
  'WFH',
  'WORK_FROM_HOME',
  'FROM_HOME',
  'WORKFROMHOME',
  'REMOTE',
  'REMOTE_WORK',
]);

export function isWfhCode(raw) {
  if (raw == null || raw === '') return false;
  const key = String(raw).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (WFH_CODES.has(key)) return true;
  return key.includes('FROM_HOME') || key.includes('WFH') || key.includes('REMOTE');
}

/**
 * @param {string} raw
 * @param {{ compact?: boolean }} [opts] - compact:true → "WFH", else "Work From Home"
 */
export function formatWorkLocationLabel(raw, opts = {}) {
  if (raw == null || raw === '') return opts.fallback ?? '-';
  const key = String(raw).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (isWfhCode(key)) {
    return opts.compact ? 'WFH' : 'Work From Home';
  }
  if (key === 'OFFICE' || key === 'IN_OFFICE' || key === 'ON_SITE' || key === 'ONSITE') {
    return 'Office';
  }
  return String(raw)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format leave-type codes/names for UI (maps WFH variants to Work From Home).
 */
export function formatLeaveTypeLabel(raw, opts = {}) {
  if (raw == null || raw === '') return opts.fallback ?? 'Leave';
  if (typeof raw === 'object') {
    const name = raw.leaveTypeName || raw.name || raw.code || raw.leaveTypeCode;
    return formatLeaveTypeLabel(name, opts);
  }
  if (isWfhCode(raw)) {
    return opts.compact ? 'WFH' : 'Work From Home';
  }
  return String(raw)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
