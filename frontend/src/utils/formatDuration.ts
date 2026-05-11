export function formatDuration(start?: string | Date, end?: string | Date): string {
  if (!start || !end) return "0s";

  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  let diff = Math.abs(endTime - startTime); // in ms

  const totalSeconds = Math.floor(diff / 1000);

  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  // show seconds only if duration is small
  if (days === 0 && hours === 0 && seconds > 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(" ");
}