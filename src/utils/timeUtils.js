/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export const formatDateLocal = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Resolve employee business code for attendance merge (never numeric DB id). */
export const resolveAttendanceEmployeeCode = (record) => {
  if (!record) return '';
  const code = record.employeeId
    || record.employeeIdString
    || record.employee?.employeeId
    || record.employee?.employeeIdString;
  if (!code) return '';
  const str = String(code).trim();
  if (/^\d+$/.test(str)) return '';
  return str.toUpperCase();
};

/** Normalize clock-in/out from API shapes to a displayable value or '--:--'. */
export const resolveAttendanceClockTime = (record, field) => {
  if (!record) return '--:--';
  const aliases = field === 'in'
    ? ['clockInTime', 'checkInTime', 'clockIn', 'checkIn']
    : ['clockOutTime', 'checkOutTime', 'clockOut', 'checkOut'];
  for (const key of aliases) {
    const val = record[key];
    if (val != null && val !== '' && val !== '--:--' && val !== '-') {
      return val;
    }
  }
  return '--:--';
};

/**
 * Formats a 24-hour time string (HH:mm or HH:mm:ss) to a 12-hour format with AM/PM.
 * Handles already formatted strings and invalid inputs gracefully.
 * 
 * @param {string} timeStr - The time string to format
 * @returns {string} - Formatted time string (e.g., "02:30 PM") or original string if invalid
 */
/**
 * Parse 24h "HH:mm" into 12-hour picker parts.
 */
export const parseTime24 = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hour12: '', minute: '00', period: 'AM' };
  }
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (!match) {
    return { hour12: '', minute: '00', period: 'AM' };
  }
  let hours = parseInt(match[1], 10);
  const minute = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return { hour12: String(hours), minute, period };
};

/**
 * Build 24h "HH:mm" from 12-hour picker parts.
 */
export const toTime24 = (hour12, minute, period) => {
  if (!hour12) return '';
  let h = parseInt(hour12, 10);
  if (Number.isNaN(h) || h < 1 || h > 12) return '';
  const m = String(minute || '00').padStart(2, '0').slice(0, 2);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
};

/** Normalize "HH:mm:ss" or "H:mm" to "HH:mm". */
export const normalizeTimeHHmm = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** 15-minute slots for the full day (00:00–23:45). */
export const generateTimeSlots = (stepMinutes = 15) => {
  const slots = [];
  for (let total = 0; total < 24 * 60; total += stepMinutes) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
};

/**
 * Parse flexible typed time: "9:30", "9:30 am", "930pm", "21:30".
 * Returns "HH:mm" or empty string.
 */
export const getNowTime24 = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const parseFlexibleTimeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  const raw = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return '';

  const hasAm = raw.includes('am');
  const hasPm = raw.includes('pm');
  const cleaned = raw.replace(/am|pm/g, '');

  let h;
  let m;

  if (cleaned.includes(':')) {
    const [hs, ms] = cleaned.split(':');
    h = parseInt(hs, 10);
    m = parseInt(ms, 10);
  } else if (cleaned.length <= 2) {
    h = parseInt(cleaned, 10);
    m = 0;
  } else if (cleaned.length === 3) {
    h = parseInt(cleaned.slice(0, 1), 10);
    m = parseInt(cleaned.slice(1), 10);
  } else if (cleaned.length >= 4) {
    h = parseInt(cleaned.slice(0, 2), 10);
    m = parseInt(cleaned.slice(2, 4), 10);
  } else {
    return '';
  }

  if (Number.isNaN(h) || Number.isNaN(m) || m > 59) return '';

  if (hasPm && h < 12) h += 12;
  if (hasAm && h === 12) h = 0;
  if (!hasAm && !hasPm && h >= 13 && h <= 23) {
    // 24-hour input, e.g. 14:30 or 21:07
  } else if (!hasAm && !hasPm && h >= 1 && h <= 11) {
    // 9:07 → 09:07 AM
  } else if (!hasAm && !hasPm && h === 12) {
    // 12:00 → noon
  }
  if (h > 23) return '';

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Normalize API time values (string, LocalTime object, or [h,m,s] array) to HH:mm or HH:mm:ss. */
export const normalizeTimeValue = (timeVal) => {
  if (timeVal == null || timeVal === '') return null;
  if (typeof timeVal === 'string') {
    const t = timeVal.trim();
    if (!t || t === '--:--' || t === '-') return null;
    return t;
  }
  if (Array.isArray(timeVal) && timeVal.length >= 2) {
    const [h, m, s] = timeVal;
    if (timeVal.length >= 3 && s != null) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof timeVal === 'object') {
    const h = timeVal.hour ?? timeVal.hours;
    const m = timeVal.minute ?? timeVal.minutes;
    const s = timeVal.second ?? timeVal.seconds;
    if (h == null && m == null) return null;
    if (s != null) {
      return `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
  }
  const asString = String(timeVal).trim();
  return asString && asString !== '[object Object]' ? asString : null;
};

export const formatTimeTo12h = (timeVal) => {
  const normalized = normalizeTimeValue(timeVal);
  if (!normalized) return '--:--';

  const trimmedTime = normalized.trim();
  
  // If it's already in 12h format (contains AM/PM), return it as is
  if (trimmedTime.toUpperCase().includes('AM') || trimmedTime.toUpperCase().includes('PM')) {
    return trimmedTime;
  }

  // Support HH:mm or HH:mm:ss
  // Captures hours (1), minutes (2), and optional seconds (4)
  const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)(:([0-5]\d))?/;
  const match = trimmedTime.match(timeRegex);
  
  if (!match) return trimmedTime;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  // Pad hours with leading zero for consistency (e.g. "02:30 PM")
  const paddedHours = String(hours).padStart(2, '0');
  
  return `${paddedHours}:${minutes} ${ampm}`;
};

export const formatEntryTimeRange = (entry) => {
  if (!entry) return null;
  const inFmt = formatTimeTo12h(entry.clockIn);
  const outFmt = formatTimeTo12h(entry.clockOut);
  if (inFmt === '--:--' || outFmt === '--:--') return null;
  return `${inFmt} - ${outFmt}`;
};

/** Parse HH:mm or HH:mm:ss to minutes since midnight. */
export const parseTimeToMinutes = (timeVal) => {
  const normalized = normalizeTimeValue(timeVal);
  if (!normalized) return null;
  const parts = normalized.split(':').map((p) => parseInt(p, 10) || 0);
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

/** True when two clock ranges overlap (touching endpoints are allowed). */
export const doTimeRangesOverlap = (clockInA, clockOutA, clockInB, clockOutB) => {
  const startA = parseTimeToMinutes(clockInA);
  const endA = parseTimeToMinutes(clockOutA);
  const startB = parseTimeToMinutes(clockInB);
  const endB = parseTimeToMinutes(clockOutB);
  if ([startA, endA, startB, endB].some((v) => v == null)) return false;

  let endANorm = endA;
  let endBNorm = endB;
  if (endANorm <= startA) endANorm += 24 * 60;
  if (endBNorm <= startB) endBNorm += 24 * 60;

  return startA < endBNorm && startB < endANorm;
};

/** Find first entry on the same day whose time range overlaps the given range. */
export const findOverlappingTimesheetEntry = (
  entries,
  { workDate, clockIn, clockOut, excludeEntryId }
) => {
  if (!workDate || !clockIn || !clockOut || !Array.isArray(entries)) return null;

  const normalizeDate = (entryDate) => {
    if (!entryDate) return null;
    if (entryDate instanceof Date) return entryDate.toISOString().split('T')[0];
    if (typeof entryDate === 'string') return entryDate.includes('T') ? entryDate.split('T')[0] : entryDate;
    return String(entryDate);
  };

  const targetDate = normalizeDate(workDate);

  return entries.find((entry) => {
    if (excludeEntryId && entry.id === excludeEntryId) return false;
    if (entry.isCancelled || entry.cancelled) return false;
    if (normalizeDate(entry.workDate || entry.date || entry.entryDate) !== targetDate) return false;
    if (!entry.clockIn || !entry.clockOut) return false;
    return doTimeRangesOverlap(clockIn, clockOut, entry.clockIn, entry.clockOut);
  }) || null;
};

/**
 * Validates a description for timesheet entries.
 * 
 * @param {string} description - The description to validate
 * @returns {string|null} - Error message or null if valid
 */
export const validateDescription = (description) => {
  if (!description || !description.trim()) {
    return "Description is required.";
  }
  const trimmed = description.trim();
  if (trimmed.length < 10) {
    return "Description must be at least 10 characters long.";
  }
  if (trimmed.length > 1500) {
    return "Description cannot exceed 1500 characters.";
  }
  // No more than 5 consecutive same characters
  if (/(.)\1{5,}/.test(trimmed)) {
    return "Description contains invalid repeated characters.";
  }
  // Must contain at least one alphabet or number
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return "Description must contain valid text.";
  }
  return null;
};

/**
 * Formats decimal hours into a "H:MM" string format.
 * Example: 2.5 becomes "2:30", 2.0833 becomes "2:05".
 * 
 * @param {number|string} hours - The decimal hours to format
 * @returns {string} - Formatted string (e.g., "2:30")
 */
export const formatHours = (hours) => {
  if (!hours && hours !== 0) return '0:00';
  const strVal = String(hours).trim();
  if (strVal.includes(':')) {
    // If it's already in format H:MM or HH:MM:SS, just normalize it to remove seconds if present
    const parts = strVal.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1].slice(0, 2)}`;
    }
    return strVal;
  }
  const numHours = parseFloat(strVal);
  if (isNaN(numHours)) return '0:00';
  
  const h = Math.floor(Math.abs(numHours));
  const m = Math.round((Math.abs(numHours) - h) * 60);
  
  // Handle case where rounding minutes gives 60
  const finalH = m === 60 ? h + 1 : h;
  const finalM = m === 60 ? 0 : m;
  
  const sign = numHours < 0 ? '-' : '';
  return `${sign}${finalH}:${String(finalM).padStart(2, '0')}`;
};

/**
 * Formats hours as "Xh Ym" (e.g. 8.5 → "8h 30m", 2:05 → "2h 5m").
 */
export const formatHoursAndMinutes = (hours) => {
  if (hours == null || hours === '' || hours === '--') return '0h 0m';
  const hm = formatHours(hours);
  const negative = String(hm).startsWith('-');
  const [hPart, mPart = '0'] = String(hm).replace(/^-/, '').split(':');
  const h = parseInt(hPart, 10) || 0;
  const m = parseInt(mPart, 10) || 0;
  return `${negative ? '-' : ''}${h}h ${m}m`;
};

export const getTimesheetEntryHours = (entry) => {
  const raw = entry?.hours ?? entry?.totalHours ?? 0;
  if (typeof raw === 'number') return raw;
  const parsed = parseFloat(String(raw).replace(',', '.'));
  if (!Number.isNaN(parsed)) return parsed;
  const parts = String(raw).trim().split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h + m / 60;
  }
  return 0;
};

/** Mirrors TimesheetEntryDto: approved → APPROVED; submittedAt → PENDING; else DRAFT/REJECTED. */
export const isSubmittedTimesheetEntry = (entry) => {
  if (!entry || entry.isCancelled || entry.cancelled) return false;
  if (entry.rejected === true) return false;
  if (entry.approved === true) return true;
  if (entry.submittedAt) return true;

  const status = String(entry.status || 'DRAFT').trim().toUpperCase();
  if (status === 'DRAFT' || status === 'REJECTED' || status === 'CANCELLED') return false;
  if (status === 'PENDING' || status === 'APPROVED') return true;
  return false;
};

/** Sum submitted entry hours in a week that fall within the selected YYYY-MM month. */
export const calculateSubmittedHoursForMonthInWeek = (entries, monthKey, weekDateStrings, normalizeDate) => {
  if (!monthKey || !Array.isArray(entries) || !Array.isArray(weekDateStrings)) return 0;
  const weekDates = new Set(weekDateStrings);

  return entries.reduce((sum, entry) => {
    const dateStr = normalizeDate(entry.workDate || entry.date || entry.entryDate);
    if (!dateStr || !weekDates.has(dateStr) || !dateStr.startsWith(monthKey)) return sum;
    if (!isSubmittedTimesheetEntry(entry)) return sum;
    return sum + getTimesheetEntryHours(entry);
  }, 0);
};

/**
 * Parse HH:MM:SS, HH:MM, legacy HH.MM (8.30 = 8h 30m), or decimal hours.
 */
export const hhmmssToDecimalHours = (value) => {
  if (value == null || value === '') return 0;
  const s = String(value).trim();
  if (!s) return 0;

  if (s.includes(':')) {
    const parts = s.split(':').map((p) => parseInt(p, 10) || 0);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const sec = parts[2] || 0;
    return h + m / 60 + sec / 3600;
  }

  if (s.includes('.')) {
    const [whole, frac = ''] = s.split('.');
    const h = parseInt(whole, 10) || 0;
    const fracNum = parseInt(frac, 10);
    if (frac.length <= 2 && !isNaN(fracNum)) {
      return h + fracNum / 60;
    }
    const asDecimal = parseFloat(s);
    return isNaN(asDecimal) ? 0 : asDecimal;
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

/**
 * Convert decimal hours to HH:MM:SS (e.g. 8.5 → "08:30:00").
 */
export const decimalHoursToHHMMSS = (hours) => {
  if (hours == null || hours === '') return '';
  let num;
  if (typeof hours === 'string' && hours.includes(':')) {
    num = hhmmssToDecimalHours(hours);
  } else {
    num = parseFloat(hours);
  }
  if (isNaN(num) || num < 0) return '';
  const totalSeconds = Math.round(num * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Normalize user input to HH:MM:SS; returns '' if invalid or zero. */
export const normalizeHHMMSS = (value) => {
  if (value == null || !String(value).trim()) return '';
  const decimal = hhmmssToDecimalHours(value);
  if (decimal <= 0) return '';
  return decimalHoursToHHMMSS(decimal);
};

/** True if value parses to a positive duration. */
export const hasPositiveHours = (value) => hhmmssToDecimalHours(value) > 0;
