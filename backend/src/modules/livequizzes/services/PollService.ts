import { injectable, inject } from 'inversify';
import crypto from 'crypto';
import { Room } from '../../../shared/database/models/Room.js';
import { pollSocket } from '../utils/PollSocket.js';
import { UserModel } from '#root/shared/database/models/User.js';
import { evaluateBadges } from '../utils/achievementEngine.js';
import UserAchievement from '#root/shared/database/models/UserAchievement.js';
import Badge from '#root/shared/database/models/Badge.js';
import { updateRoomStats } from '../utils/statsService.js';
import { calculateScore } from '../utils/calculateScore.js';
import { BadRequestError, NotFoundError } from 'routing-controllers';

type PollDifficulty = 'easy' | 'medium' | 'hard';

interface InMemoryPoll {
  pollId: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  responses: Record<string, number>; // optionIndex: count
  totalResponses: number;
  userResponses: Map<string, number>; // userId: optionIndex
  timer: number;
  startTime?: number;
  timeLeft: number;
  roomCode: string;
  createdAt?: Date;
  lockedActiveUsers?: string[];
  maxPoints?: number;
}

@injectable()
export class PollService {
  private pollSocket = pollSocket;
  private activePolls = new Map<string, InMemoryPoll>(); // pollId -> InMemoryPoll
  private pollTimers = new Map<string, NodeJS.Timeout>(); // pollId -> timer
  async createPoll(roomCode: string, data: {
    question: string;
    options: string[];
    correctOptionIndex: number;
    timer?: number;
    maxPoints?: number;
  }) {
    const pollId = crypto.randomUUID();
    const createdAt = new Date();
    const lockedActiveUsers: string[] = pollSocket.getActiveUsersInRoom(roomCode);
    const poll = {
      _id: pollId,
      question: data.question,
      options: data.options,
      correctOptionIndex: data.correctOptionIndex,
      timer: data.timer ?? 30,
      maxPoints: data.maxPoints ?? 20,
      createdAt,
      lockedActiveUsers,
      answers: []
    };

    const livepoll: InMemoryPoll = {
      pollId,
      question: data.question,
      options: data.options,
      correctOptionIndex: data.correctOptionIndex,
      responses: {},
      totalResponses: 0,
      userResponses: new Map(),
      timer: data.timer ?? 0, // 0 means no timer
      timeLeft: data.timer ?? 0,
      roomCode,
      createdAt,
      lockedActiveUsers: [...lockedActiveUsers],
      maxPoints: data.maxPoints ?? 20,
    };

    await Room.updateOne(
      { roomCode },
      { $push: { polls: poll } }
    );

    this.activePolls.set(pollId, livepoll);

    pollSocket.emitToRoom(roomCode, 'new-poll', poll);
    return poll;
  }



  async submitAnswer(roomCode: string, pollId: string, userId: string, answerIndex: number) {

    const poll = this.activePolls.get(pollId);
    if (!poll || poll.roomCode !== roomCode) {
      throw new Error('Poll not found or invalid room');
    }

    // Update in-memory response tracking
    const previousResponse = poll.userResponses.get(userId);

    // If user already answered, decrement previous response count
    if (previousResponse !== undefined) {
      const prevOption = previousResponse.toString();
      poll.responses[prevOption] = (poll.responses[prevOption] || 1) - 1;
      poll.totalResponses--;
    }

    // Update new response
    poll.userResponses.set(userId, answerIndex);
    const optionKey = answerIndex.toString();
    poll.responses[optionKey] = (poll.responses[optionKey] || 0) + 1;
    poll.totalResponses++;

    // Emit update to all clients
    this.emitPollUpdate(roomCode, pollId);

    const answeredAt = new Date();

    // Determine correctness
    const isCorrect = poll.correctOptionIndex === answerIndex;

    // Calculate response time (seconds)
    const responseTime = (answeredAt.getTime() - poll.createdAt.getTime()) / 1000;

    const points = calculateScore({
      isCorrect,
      responseTime,
      maxPoints: poll?.maxPoints,
      timer: poll.timer
    });

    await Room.updateOne(
      { roomCode, "polls._id": pollId },
      { $push: { "polls.$.answers": { userId, answerIndex, answeredAt, points } } }
    );



    // Update room stats
    const stats = await updateRoomStats({
      userId,
      roomCode,
      isCorrect,
      responseTime,
      points,
    });

    // Evaluate badges and notify room in real time when unlocked
    const newlyUnlockedBadges = await evaluateBadges(userId, roomCode, stats);
    if (newlyUnlockedBadges.length > 0) {
      pollSocket.emitToRoom(roomCode, 'badge-earned', {
        userId,
        roomCode,
        badges: newlyUnlockedBadges,
      });
    }
  }

  async submitDifficulty(
    roomCode: string,
    pollId: string,
    userId: string,
    difficulty: PollDifficulty,
  ) {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError('Room not found');

    const poll = room.polls.find(p => p._id === pollId);
    if (!poll) throw new NotFoundError('Poll not found');

    const answers = poll.answers?.filter(a => a.userId === userId) ?? [];
    if (answers.length === 0) {
      throw new NotFoundError('Answer not found for this user');
    }

    // Set difficulty on the latest answer (by answeredAt)
    const latestAnswer = answers.reduce((latest, current) => {
      const latestTime = latest?.answeredAt?.getTime?.() ?? 0;
      const currentTime = current?.answeredAt?.getTime?.() ?? 0;
      return currentTime >= latestTime ? current : latest;
    }, answers[0]);

    if (!latestAnswer) {
      throw new NotFoundError('Answer not found for this user');
    }

    if (latestAnswer.difficulty) {
      throw new BadRequestError('Difficulty already submitted');
    }

    latestAnswer.difficulty = difficulty;
    latestAnswer.difficultyAnsweredAt = new Date();
    await room.save();
  }

  async getPollInsights(roomCode: string) {
    const room = await Room.findOne({ roomCode }).lean();
    if (!room) throw new NotFoundError('Room not found');

    const thresholdHighCorrect = 60; // percent

    const insights = (room.polls ?? []).map(poll => {
      // Dedupe by userId (take latest answeredAt)
      const latestByUser = new Map<string, any>();
      for (const ans of poll.answers ?? []) {
        const previous = latestByUser.get(ans.userId);
        const prevTime = previous?.answeredAt ? new Date(previous.answeredAt).getTime() : 0;
        const curTime = ans?.answeredAt ? new Date(ans.answeredAt).getTime() : 0;
        if (!previous || curTime >= prevTime) {
          latestByUser.set(ans.userId, ans);
        }
      }
      const answers = Array.from(latestByUser.values());
      const total = answers.length;
      const correctCount = answers.filter(a => a.answerIndex === poll.correctOptionIndex).length;
      const correctPercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

      const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
      for (const a of answers) {
        if (a?.difficulty === 'easy') difficultyCounts.easy += 1;
        if (a?.difficulty === 'medium') difficultyCounts.medium += 1;
        if (a?.difficulty === 'hard') difficultyCounts.hard += 1;
      }
      const difficultyTotal = difficultyCounts.easy + difficultyCounts.medium + difficultyCounts.hard;
      const difficultyPercent = {
        easy: difficultyTotal ? Math.round((difficultyCounts.easy / difficultyTotal) * 100) : 0,
        medium: difficultyTotal ? Math.round((difficultyCounts.medium / difficultyTotal) * 100) : 0,
        hard: difficultyTotal ? Math.round((difficultyCounts.hard / difficultyTotal) * 100) : 0,
      };

      const isHighCorrect = correctPercent >= thresholdHighCorrect;
      let dominantDifficulty: 'easy' | 'medium' | 'hard' | 'mixed' | 'unknown' = 'unknown';
      if (difficultyTotal === 0) {
        dominantDifficulty = 'unknown';
      } else {
        const max = Math.max(difficultyCounts.easy, difficultyCounts.medium, difficultyCounts.hard);
        const winners = (['easy', 'medium', 'hard'] as const).filter(
          d => difficultyCounts[d] === max,
        );
        dominantDifficulty = winners.length === 1 ? winners[0] : 'mixed';
      }

      const majorityLabel =
        dominantDifficulty === 'easy'
          ? 'Easy'
          : dominantDifficulty === 'medium'
          ? 'Medium'
          : dominantDifficulty === 'hard'
          ? 'Hard'
          : dominantDifficulty === 'mixed'
          ? 'Mixed'
          : 'Unknown';

      const insight = (() => {
        if (total === 0) return 'No responses yet.';

        if (dominantDifficulty === 'medium') {
          return `${correctPercent}% correct, majority marked Medium → Balanced difficulty, good concept-check question`;
        }

        if (dominantDifficulty === 'easy' && isHighCorrect) {
          return 'Well-understood concept, suitable for quick checks';
        }
        if (dominantDifficulty === 'hard' && isHighCorrect) {
          return 'Concept understood but perceived tricky—good for exams';
        }
        if (dominantDifficulty === 'easy' && !isHighCorrect) {
          return 'Likely ambiguity or misconception—review question';
        }
        if (dominantDifficulty === 'hard' && !isHighCorrect) {
          return 'Concept not understood—needs reteaching';
        }

        // fallback
        return `${correctPercent}% correct, majority marked ${majorityLabel} → Review results`;
      })();

      return {
        pollId: poll._id,
        question: poll.question,
        totalAnswers: total,
        correctCount,
        correctPercent,
        difficultyCounts,
        difficultyPercent,
        difficultyTotal,
        dominantDifficulty,
        insight,
      };
    });

    return { roomCode, insights };
  }

  async getPollResults(roomCode: string) {
    const room = await Room.findOne({ roomCode });
    if (!room) return null;

    const results: Record<string, Record<string, { count: number; users: { id: string; name: string }[] }>> = {};

    for (const poll of room.polls) {
      const counts = Array(poll.options.length).fill(0);
      const userIds = poll.options.map(() => [] as string[]);

      for (const ans of poll.answers) {
        if (ans.answerIndex >= 0 && ans.answerIndex < poll.options.length) {
          counts[ans.answerIndex]++;
          userIds[ans.answerIndex].push(ans.userId);
        }
      }
      const allUserIds = [...new Set(poll.answers.map(ans => ans.userId))];
      const users = await UserModel.find({ firebaseUID: { $in: allUserIds } }, { firebaseUID: 1, firstName: 1, lastName: 1 });
      const userMap = new Map(users.map(user => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
        return [user.firebaseUID, { id: user.firebaseUID, name: fullName }];
      }));

      const pollResult = poll.options.reduce((acc, opt, i) => {
        const usersForOption = userIds[i].map(userId => {
          const user = userMap.get(userId);
          return user || { id: userId, name: 'Unknown User' };
        });
        acc[opt] = {
          count: counts[i],
          users: usersForOption
        };
        return acc;
      }, {} as Record<string, { count: number; users: { id: string; name: string }[] }>);

      results[poll.question] = pollResult;
    }

    return results;
  }


  private emitPollUpdate(roomCode: string, pollId: string) {
    const poll = this.activePolls.get(pollId);
    if (!poll) return;

    const pollData = this.getPollData(poll);

    // Emit to all clients in the room
    // console.log(`[POLL Service]Emitting in-memory-poll-update for room ${roomCode}:`, pollData);
    this.pollSocket.emitToAll(roomCode, 'live-poll-results', pollData);
  }

  private getPollData(poll: InMemoryPoll) {
    // Calculate correct percentage
    const correctResponses = poll.responses[poll.correctOptionIndex] || 0;
    const correctPercentage = poll.totalResponses > 0
      ? Math.round((correctResponses / poll.totalResponses) * 100)
      : 0;

    // Convert userResponses Map to plain object
    const userResponses = Object.fromEntries(poll.userResponses);

    return {
      pollId: poll.pollId,
      question: poll.question,
      options: poll.options,
      correctOptionIndex: poll.correctOptionIndex,
      responses: { ...poll.responses },
      totalResponses: poll.totalResponses,
      timeLeft: poll.timeLeft,
      timer: poll.timer,
      correctPercentage,
      userResponses,
      roomCode: poll.roomCode,
    };
  }

 async getUserAchievements(userId: string) {
  const [achievedBadgesRaw, allBadges] = await Promise.all([
    UserAchievement.find({ userId })
      .populate("badgeId")
      .lean(),
    Badge.find().lean()
  ]);

  const achievedBadges = achievedBadgesRaw.filter((a: any) => a?.badgeId?._id);
  const achievedBadgeIds = new Set(
    achievedBadges.map((a: any) => a.badgeId._id.toString())
  );

  const unachievedBadges = allBadges.filter(
    badge => !achievedBadgeIds.has(badge._id.toString())
  );

  return { achievedBadges, unachievedBadges };
}

}
