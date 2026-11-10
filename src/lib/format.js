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
