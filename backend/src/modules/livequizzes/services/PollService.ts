import { injectable, inject } from 'inversify';
import crypto from 'crypto';
import { Room } from '../../../shared/database/models/Room.js';
import { pollSocket } from '../utils/PollSocket.js';
import { UserModel } from '#root/shared/database/models/User.js';
import { ScoringService } from './ScoringService.js';

interface InMemoryPoll {
  pollId: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  responses: Record<string, number>; // optionIndex: count
  totalResponses: number;
  userResponses: Map<string, number>; // userId: optionIndex
  timer: number;
  maxPoints: number;
  startTime?: number;
  timeLeft: number;
  roomCode: string;
  releasedAt?: Date; // When poll was released to students
}

@injectable()
export class PollService {
  private pollSocket = pollSocket;
  private activePolls = new Map<string, InMemoryPoll>(); // pollId -> InMemoryPoll
  private pollTimers = new Map<string, NodeJS.Timeout>(); // pollId -> timer
  private scoringService: ScoringService;

  constructor() {
    this.scoringService = new ScoringService();
  }

  async createPoll(roomCode: string, data: {
    question: string;
    options: string[];
    correctOptionIndex: number;
    timer?: number;
    maxPoints?: number;
  }) {
    const pollId = crypto.randomUUID();
    const releasedAt = new Date();

    const poll = {
      _id: pollId,
      question: data.question,
      options: data.options,
      correctOptionIndex: data.correctOptionIndex,
      timer: data.timer ?? 30,
      maxPoints: data.maxPoints ?? 100,
      createdAt: new Date(),
      releasedAt,
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
      maxPoints: data.maxPoints ?? 100,
      timeLeft: data.timer ?? 0,
      roomCode,
      releasedAt,
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

    const answeredAt = new Date();
    
    // Calculate response time and points
    let responseTime = 0;
    let pointsEarned = 0;
    
    if (poll.releasedAt) {
      responseTime = this.scoringService.calculateResponseTime(poll.releasedAt, answeredAt);
      const isCorrect = answerIndex === poll.correctOptionIndex;
      pointsEarned = this.scoringService.calculatePoints(
        isCorrect,
        responseTime,
        poll.timer,
        poll.maxPoints
      );
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

    await Room.updateOne(
      { roomCode, "polls._id": pollId },
      { 
        $push: { 
          "polls.$.answers": { 
            userId, 
            answerIndex, 
            answeredAt,
            responseTime,
            pointsEarned
          } 
        } 
      }
    );

    return {
      pointsEarned,
      responseTime,
      isCorrect: answerIndex === poll.correctOptionIndex
    };
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

  /**
   * Get leaderboard for a room based on total points earned
   */
  async getLeaderboard(roomCode: string) {
    const room = await Room.findOne({ roomCode });
    if (!room) return null;

    const userScores = new Map<string, number>();

    // Calculate total points for each user across all polls
    for (const poll of room.polls) {
      for (const answer of poll.answers) {
        const currentScore = userScores.get(answer.userId) || 0;
        userScores.set(answer.userId, currentScore + (answer.pointsEarned || 0));
      }
    }

    // Get user details
    const allUserIds = Array.from(userScores.keys());
    const users = await UserModel.find(
      { firebaseUID: { $in: allUserIds } },
      { firebaseUID: 1, firstName: 1, lastName: 1 }
    );

    const userMap = new Map(users.map(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
      return [user.firebaseUID, fullName];
    }));

    // Create leaderboard using scoring service
    const leaderboard = this.scoringService.getLeaderboard(userScores);

    return leaderboard.map(entry => ({
      userId: entry.userId,
      userName: userMap.get(entry.userId) || 'Unknown User',
      totalPoints: entry.totalPoints,
      rank: entry.rank
    }));
  }

  /**
   * Get individual user's score for a room
   */
  async getUserScore(roomCode: string, userId: string) {
    const room = await Room.findOne({ roomCode });
    if (!room) return null;

    let totalPoints = 0;
    let correctAnswers = 0;
    let totalAnswers = 0;

    for (const poll of room.polls) {
      const userAnswer = poll.answers.find(ans => ans.userId === userId);
      if (userAnswer) {
        totalAnswers++;
        totalPoints += userAnswer.pointsEarned || 0;
        if (userAnswer.answerIndex === poll.correctOptionIndex) {
          correctAnswers++;
        }
      }
    }

    return {
      userId,
      totalPoints,
      correctAnswers,
      totalAnswers,
      accuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0
    };
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
}
