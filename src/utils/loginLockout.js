const lockMap = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

export function checkLock(email) {
  if (!email) return null;
  const emailKey = email.trim().toLowerCase();
  const entry = lockMap.get(emailKey);
  if (entry && entry.lockedUntil) {
    const remaining = entry.lockedUntil - Date.now();
    if (remaining > 0) {
      return remaining;
    } else {
      lockMap.delete(emailKey);
    }
  }
  return null;
}

export function recordFailure(email) {
  if (!email) return { failures: 0, lockedUntil: null };
  const emailKey = email.trim().toLowerCase();
  let entry = lockMap.get(emailKey) || { failures: 0, lockedUntil: null };
  
  entry.failures += 1;
  if (entry.failures >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.failures = 0;
  }
  
  lockMap.set(emailKey, entry);
  return entry;
}

export function resetAttempts(email) {
  if (!email) return;
  const emailKey = email.trim().toLowerCase();
  lockMap.delete(emailKey);
}
