/**
 * Extract a user-facing message from an API error (handles plain string or JSON body).
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  // Remove all HTML tag patterns
  let clean = str.replace(/<[^>]*>/g, '');
  // Escape remaining HTML special characters
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data;
  let message = fallback;
  if (typeof data === 'string' && data.trim()) {
    message = data.trim();
  } else if (data?.message) {
    message = data.message;
  } else if (typeof data?.error === 'string' && data.error.trim()) {
    message = data.error;
  } else if (error?.message) {
    message = error.message;
  }
  return sanitizeString(message);
}

export function isEmployeeLimitError(error) {
  const data = error?.response?.data;
  if (data?.code === 'EMPLOYEE_LIMIT_EXCEEDED') {
    return true;
  }
  const message = getApiErrorMessage(error, '');
  return /employee seat|employee limit|plan allows/i.test(message);
}

/**
 * Friendly message when the tenant is already at their plan seat limit.
 */
export function formatLimitReachedMessage(limit) {
  if (!limit?.maxEmployees) {
    return 'You have reached your plan employee limit. Upgrade your plan in Organization Settings to add more team members.';
  }
  const plan = limit.planName || 'current';
  const current = limit.currentEmployeeCount ?? 0;
  const max = limit.maxEmployees;
  return `You've used all employee seats on your ${plan} plan (${current} of ${max}). Upgrade your plan in Organization Settings to add more team members.`;
}

/**
 * Friendly message when a bulk import exceeds remaining seats.
 */
export function formatImportLimitMessage(limit, importCount) {
  if (!limit?.maxEmployees) {
    return 'This import would exceed your plan employee limit. Upgrade your plan or reduce the number of rows.';
  }
  const plan = limit.planName || 'current';
  const current = limit.currentEmployeeCount ?? 0;
  const max = limit.maxEmployees;
  const remaining = limit.remainingSeats ?? Math.max(0, max - current);
  return `Your ${plan} plan has ${remaining} seat${remaining === 1 ? '' : 's'} left (${current} of ${max} used), but this import has ${importCount} employee${importCount === 1 ? '' : 's'}. Remove extra rows or upgrade your plan.`;
}
