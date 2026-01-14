import { injectable } from 'inversify';

/**
 * Service responsible for calculating time-aware scores for poll answers
 */
@injectable()
export class ScoringService {
  /**
   * Calculate points earned based on response time and correctness
   * 
   * @param isCorrect - Whether the answer is correct
   * @param responseTimeMs - Time taken to answer in milliseconds
   * @param timerSeconds - Total time allowed for the question in seconds
   * @param maxPoints - Maximum points available for the question
   * @returns Points earned (0 if incorrect or too late)
   */
  calculatePoints(
    isCorrect: boolean,
    responseTimeMs: number,
    timerSeconds: number,
    maxPoints: number = 100
  ): number {
    // No points for incorrect answers
    if (!isCorrect) {
      return 0;
    }

    // No timer means full points for correct answer
    if (timerSeconds <= 0) {
      return maxPoints;
    }

    const timerMs = timerSeconds * 1000;

    // No points if answered after time limit
    if (responseTimeMs > timerMs) {
      return 0;
    }

    // Calculate time-based multiplier
    // Faster answers get more points
    // Formula: points = maxPoints * (1 - (responseTime / totalTime) * 0.5)
    // This gives 100% points at t=0 and 50% points at t=timerMs
    const timeRatio = responseTimeMs / timerMs;
    const pointMultiplier = 1 - (timeRatio * 0.5);
    
    const points = Math.round(maxPoints * pointMultiplier);
    
    // Ensure points are within valid range
    return Math.max(0, Math.min(maxPoints, points));
  }

  /**
   * Calculate response time between poll release and answer submission
   * 
   * @param releasedAt - When the poll was released to students
   * @param answeredAt - When the answer was submitted
   * @returns Response time in milliseconds
   */
  calculateResponseTime(releasedAt: Date, answeredAt: Date): number {
    return answeredAt.getTime() - releasedAt.getTime();
  }

  /**
   * Get leaderboard rankings for a room based on total points
   * 
   * @param userScores - Map of userId to total points
   * @returns Sorted array of leaderboard entries
   */
  getLeaderboard(userScores: Map<string, number>): Array<{ userId: string; totalPoints: number; rank: number }> {
    const entries = Array.from(userScores.entries())
      .map(([userId, totalPoints]) => ({ userId, totalPoints }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    let currentRank = 1;
    let previousScore = -1;
    
    return entries.map((entry, index) => {
      if (entry.totalPoints !== previousScore) {
        currentRank = index + 1;
        previousScore = entry.totalPoints;
      }
      return {
        ...entry,
        rank: currentRank
      };
    });
  }
}
