const usd = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 2});
const usdWhole = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});

export function formatPrice(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '';
  return Number.isInteger(amount) ? usdWhole.format(amount) : usd.format(amount);
}

export function formatLabel(value) {
  if (!value) return '';
  const words = String(value).replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatDuration(until, now = new Date()) {
  const ms = new Date(until).getTime() - now.getTime();
  if (ms <= 0) return null;
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return 'under 1m';
}

const clockTime = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit'});
const weekday = new Intl.DateTimeFormat('en-US', {weekday: 'short'});
const monthDay = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric'});
const fullDay = new Intl.DateTimeFormat('en-US', {weekday: 'long', month: 'long', day: 'numeric'});

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatShortTime(value, now = new Date()) {
  const date = new Date(value);
  const ms = now.getTime() - date.getTime();
  if (ms < 60_000) return 'now';
  if (sameDay(date, now)) return clockTime.format(date);
  if (ms < 6 * 24 * 60 * 60 * 1000) return weekday.format(date);
  return monthDay.format(date);
}

export function formatClock(value) {
  return clockTime.format(new Date(value));
}

export function formatDay(value, now = new Date()) {
  const date = new Date(value);
  if (sameDay(date, now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return fullDay.format(date);
}

export function isSameDay(a, b) {
  return sameDay(new Date(a), new Date(b));
}
