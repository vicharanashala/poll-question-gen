import { Room } from '#root/shared/database/models/Room.js';
import { pollSocket } from './PollSocket.js';

const debounceTimers = new Map<string, NodeJS.Timeout>();

export const triggerLiveOverviewUpdate = (roomCode: string) => {
  // Clear any existing timer for this specific room
  if (debounceTimers.has(roomCode)) {
    clearTimeout(debounceTimers.get(roomCode)!);
  }

  // Set a new 2000ms debounce timer
  const timer = setTimeout(async () => {
    debounceTimers.delete(roomCode);
    try {
      const dbResult = await Room.aggregate([
        { $match: { roomCode } },
        {
          $project: {
            roomCode: 1,
            name: 1,
            createdAt: 1,
            status: 1,

            totalStudents: { $size: { $ifNull: ['$joinedStudents', []] } },
            totalCohosts: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$coHosts', []] },
                  as: 'c',
                  cond: { $eq: ['$$c.isActive', true] }
                }
              }
            },
            questionsAsked: { $size: { $ifNull: ['$polls', []] } },

            pointsDistributed: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$polls', []] },
                  as: 'p',
                  in: { $ifNull: ['$$p.maxPoints', 0] }
                }
              }
            },

            earnedPoints: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$polls', []] },
                  as: 'poll',
                  in: { $sum: { $ifNull: ['$$poll.answers.points', []] } }
                }
              }
            },

            avgAccuracy: {
              $round: [
                {
                  $cond: [
                    { $gt: [{ $size: { $ifNull: ['$polls', []] } }, 0] },
                    {
                      $divide: [
                        { $sum: { $map: { input: { $ifNull: ['$polls', []] }, as: 'poll', in: { $sum: { $ifNull: ['$$poll.answers.points', []] } } } } },
                        { $size: { $ifNull: ['$polls', []] } }
                      ]
                    },
                    0
                  ]
                },
                2
              ]
            }
          }
        }
      ]);

      if (dbResult && dbResult.length > 0) {
        pollSocket.emitToRoom(roomCode, 'overview-analytics-updated', dbResult[0]);
      }
    } catch (err) {
      console.error('Failed to aggregate and emit live overview:', err);
    }
  }, 2000); // 2 second delay to perfectly batch burst updates

  debounceTimers.set(roomCode, timer);
};
