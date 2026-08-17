export const formatWatchTime = (minutes) => {
  if (!minutes) return '0m';
  const days = Math.floor(minutes / (24 * 60));
  const hrs = Math.floor((minutes % (24 * 60)) / 60);
  const mins = minutes % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  
  return parts.join(' ');
};
