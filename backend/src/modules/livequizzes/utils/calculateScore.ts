export function calculateGracePeriod(timer: number, requestedTimeWindow?: number): number {
  if (timer <= 0) return 0;

  const defaultInitialTimeWindow = 2 + (timer * 0.10);
  const windowToUse = requestedTimeWindow ?? defaultInitialTimeWindow;

  return Math.min(timer * 0.9, Math.max(windowToUse, 5));
}

export function calculateScore({
  isCorrect,
  responseTime,
  maxPoints,
  timer,
  initialTimeWindow
}: {
  isCorrect: boolean
  responseTime: number
  maxPoints: number
  timer: number
  initialTimeWindow?: number
}) {
  if (timer <= 0) return 0;
  if (!isCorrect) return 0;
  if (responseTime >= timer) return 0;

  const fullPointWindow = calculateGracePeriod(timer, initialTimeWindow);

  if (responseTime <= fullPointWindow) {
    return maxPoints;
  }

  const timeInDecayPhase = responseTime - fullPointWindow;
  const totalDecayDuration = timer - fullPointWindow;

  const decayRatio = timeInDecayPhase / totalDecayDuration;
  const points = Math.round(maxPoints * (1 - decayRatio));

  return Math.max(points, 1);
}