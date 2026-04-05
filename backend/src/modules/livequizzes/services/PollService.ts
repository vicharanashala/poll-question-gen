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
import { HttpError, NotFoundError } from 'routing-controllers';
import type { CohostType, ModerationActorType } from '../interfaces/PollRoom.js';

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
  scheduledAt?: Date;
  lockedActiveUsers?: string[];
  maxPoints?: number;
}

@injectable()
export class PollService {
  private pollSocket = pollSocket;
  private activePolls = new Map<string, InMemoryPoll>(); // pollId -> InMemoryPoll
  private pollTimers = new Map<string, NodeJS.Timeout>(); // pollId -> timer
  private scheduledPollTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.recoverScheduledPolls().catch((error) => {
      console.error('Failed to recover scheduled polls:', error);
    });
  }

  private async resolveModeratorContext(room: any, actorId: string): Promise<{
    actorType: ModerationActorType;
    cohostType?: CohostType;
    actorName: string;
  }> {
    if (room.status !== 'active') {
      throw new HttpError(400, 'Room is not active');
    }

    if (room.teacherId === actorId) {
      const host = await UserModel.findOne({ firebaseUID: actorId }, 'firstName lastName').lean();
      const actorName = host
        ? `${host.firstName || ''} ${host.lastName || ''}`.trim() || room.teacherName || 'Host'
        : room.teacherName || 'Host';
      return { actorType: 'host', actorName };
    }

    const cohost = room.coHosts.find((c: any) => c.userId?.toString() === actorId && c.isActive);
    if (!cohost) {
      throw new HttpError(403, 'Only host or cohost can moderate questions');
    }

    const cohostType: CohostType = (cohost.type as CohostType) || 'teacher';
    if (cohostType === 'guest') {
      return {
        actorType: 'cohost',
        cohostType,
        actorName: cohost.displayName || 'Guest Cohost',
      };
    }

    const user = await UserModel.findOne({ firebaseUID: actorId }, 'firstName lastName').lean();
    const actorName = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Cohost'
      : cohost.displayName || 'Cohost';

    return {
      actorType: 'cohost',
      cohostType,
      actorName,
    };
  }

  private normalizeScheduledAt(scheduledAt?: string | Date): Date | undefined {
    if (!scheduledAt) {
      return undefined;
    }

    const parsed = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private createInMemoryPoll(roomCode: string, poll: any): InMemoryPoll {
    const timer = Number(poll?.timer ?? 0);

    return {
      pollId: poll._id?.toString() || '',
      question: poll.question,
      options: poll.options || [],
      correctOptionIndex: poll.correctOptionIndex,
      responses: {},
      totalResponses: 0,
      userResponses: new Map(),
      timer,
      startTime: poll.createdAt ? new Date(poll.createdAt).getTime() : undefined,
      timeLeft: timer,
      roomCode,
      createdAt: poll.createdAt ? new Date(poll.createdAt) : new Date(),
      scheduledAt: poll.scheduledAt ? new Date(poll.scheduledAt) : undefined,
      lockedActiveUsers: [...(poll.lockedActiveUsers || [])],
      maxPoints: poll.maxPoints ?? 20,
    };
  }

  private clearScheduledLaunch(pollId: string): void {
    const existing = this.scheduledPollTimers.get(pollId);
    if (existing) {
      clearTimeout(existing);
      this.scheduledPollTimers.delete(pollId);
    }
  }

  private schedulePollLaunch(roomCode: string, pollId: string, scheduledAt: Date): void {
    this.clearScheduledLaunch(pollId);

    const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.launchScheduledPoll(roomCode, pollId).catch((error) => {
        console.error(`Failed to launch scheduled poll ${pollId}:`, error);
      });
    }, delayMs);

    this.scheduledPollTimers.set(pollId, timer);
  }

  private async launchScheduledPoll(roomCode: string, pollId: string): Promise<void> {
    this.clearScheduledLaunch(pollId);

    const room = await Room.findOne({ roomCode });
    if (!room || room.status !== 'active') {
      return;
    }

    const poll = room.polls.find((roomPoll) => roomPoll._id === pollId);
    if (!poll || poll.approvalStatus !== 'approved' || poll.isLaunched) {
      return;
    }

    const activeUsers = pollSocket.getActiveUsersInRoom(roomCode);
    poll.isLaunched = true;
    poll.launchedAt = new Date();
    poll.lockedActiveUsers = [...activeUsers];

    await room.save();

    const pollPayload = typeof (poll as any).toObject === 'function' ? (poll as any).toObject() : poll;
    this.activePolls.set(pollId, this.createInMemoryPoll(roomCode, pollPayload));
    pollSocket.emitToRoom(roomCode, 'new-poll', pollPayload);
    await pollSocket.emitRoomDashboardUpdates(roomCode);
  }

  private async recoverScheduledPolls(): Promise<void> {
    const rooms = await Room.find({
      status: 'active',
      'polls.isLaunched': false,
      'polls.approvalStatus': 'approved',
      'polls.scheduledAt': { $exists: true }
    }).lean();

    for (const room of rooms) {
      for (const poll of room.polls || []) {
        const pollId = poll?._id?.toString();
        const scheduledAt = this.normalizeScheduledAt(poll?.scheduledAt as Date | string | undefined);
        const isLaunched = poll?.isLaunched !== false;
        const isApproved = poll?.approvalStatus === 'approved';

        if (!pollId || !scheduledAt || isLaunched || !isApproved) {
          continue;
        }

        if (scheduledAt.getTime() <= Date.now()) {
          await this.launchScheduledPoll(room.roomCode, pollId);
        } else {
          this.schedulePollLaunch(room.roomCode, pollId, scheduledAt);
        }
      }
    }
  }

  async createPoll(roomCode: string, data: {
    question: string;
    options: string[];
    correctOptionIndex: number;
    timer?: number;
    maxPoints?: number;
    scheduledAt?: string | Date;
  }) {
    const pollId = crypto.randomUUID();
    const createdAt = new Date();
    const lockedActiveUsers: string[] = pollSocket.getActiveUsersInRoom(roomCode);
    const scheduledAt = this.normalizeScheduledAt(data.scheduledAt);

    // PHASE 2: Check if room requires question approval
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");

    const approvalRequired = room.questionApprovalRequired || false;
    const shouldSchedule = Boolean(scheduledAt && scheduledAt.getTime() > Date.now());
    const shouldLaunchImmediately = !approvalRequired && !shouldSchedule;

    const poll = {
      _id: pollId,
      question: data.question,
      options: data.options,
      correctOptionIndex: data.correctOptionIndex,
      timer: data.timer ?? 30,
      maxPoints: data.maxPoints ?? 20,
      scheduledAt,
      isLaunched: shouldLaunchImmediately,
      launchedAt: shouldLaunchImmediately ? createdAt : undefined,
      createdAt,
      lockedActiveUsers: shouldLaunchImmediately ? lockedActiveUsers : [],
      answers: [],
      // PHASE 2: Set approval status
      approvalStatus: approvalRequired ? 'pending' : 'approved'
    };

    await Room.updateOne(
      { roomCode },
      { $push: { polls: poll } }
    );

    if (shouldLaunchImmediately) {
      this.activePolls.set(pollId, this.createInMemoryPoll(roomCode, poll));
      pollSocket.emitToRoom(roomCode, 'new-poll', poll);
    } else if (approvalRequired) {
      pollSocket.emitToRoom(roomCode, 'question-pending-approval', poll);
    } else if (scheduledAt) {
      this.schedulePollLaunch(roomCode, pollId, scheduledAt);
    }

    await pollSocket.emitRoomDashboardUpdates(roomCode);

    return poll;
  }



  async submitAnswer(roomCode: string, pollId: string, userId: string, answerIndex: number) {

    // PHASE 3: Check if student is muted
    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError('Room not found');
    }

    const isMuted = room.mutedStudents.some(m => m.studentId === userId);
    if (isMuted) {
      throw new HttpError(403, 'You have been muted and cannot answer polls');
    }

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

    await pollSocket.emitStudentDashboardUpdate(userId);
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

  // PHASE 2: Question Approval Methods
  async approvePoll(
    roomCode: string,
    pollId: string,
    userId: string
  ): Promise<{ message: string; poll: any }> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");

    const moderator = await this.resolveModeratorContext(room, userId);

    const poll = room.polls.find(p => p._id === pollId);
    if (!poll) throw new NotFoundError("Poll not found");

    if (poll.approvalStatus !== 'pending') {
      throw new HttpError(400, `Poll is already ${poll.approvalStatus}`);
    }

    // Update poll approval status
    poll.approvalStatus = 'approved';
    poll.approvedBy = userId;
    poll.approvedByType = moderator.actorType;
    poll.approvedByCohostType = moderator.cohostType;
    poll.approvedByName = moderator.actorName;
    poll.approvedAt = new Date();

    const scheduledAt = this.normalizeScheduledAt(poll.scheduledAt as Date | string | undefined);
    const shouldSchedule = Boolean(scheduledAt && scheduledAt.getTime() > Date.now());

    if (shouldSchedule) {
      poll.isLaunched = false;
      poll.launchedAt = undefined;
      poll.lockedActiveUsers = [];
    } else {
      poll.isLaunched = true;
      poll.launchedAt = new Date();
      poll.lockedActiveUsers = pollSocket.getActiveUsersInRoom(roomCode);
    }

    await room.save();

    const pollPayload = typeof (poll as any).toObject === 'function' ? (poll as any).toObject() : poll;

    // Emit event to broadcast poll to students
    pollSocket?.emitToRoom(roomCode, 'question-approved', {
      pollId,
      poll: pollPayload,
      approvedBy: userId,
      approvedByType: moderator.actorType,
      approvedByName: moderator.actorName,
    });

    if (shouldSchedule && scheduledAt) {
      this.schedulePollLaunch(roomCode, pollId, scheduledAt);
    } else {
      this.activePolls.set(pollId, this.createInMemoryPoll(roomCode, pollPayload));
      // Also emit new-poll so students see it
      pollSocket?.emitToRoom(roomCode, 'new-poll', pollPayload);
    }

    await pollSocket.emitRoomDashboardUpdates(roomCode);

    return {
      message: 'Poll approved successfully',
      poll: pollPayload
    };
  }

  async rejectPoll(
    roomCode: string,
    pollId: string,
    userId: string,
    reason?: string
  ): Promise<{ message: string }> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");

    const moderator = await this.resolveModeratorContext(room, userId);

    const pollIndex = room.polls.findIndex(p => p._id === pollId);
    if (pollIndex === -1) throw new NotFoundError("Poll not found");

    const poll = room.polls[pollIndex];
    if (poll.approvalStatus !== 'pending') {
      throw new HttpError(400, `Poll is already ${poll.approvalStatus}`);
    }

    // Mark as rejected
    poll.approvalStatus = 'rejected';
    poll.rejectedBy = userId;
    poll.rejectedByType = moderator.actorType;
    poll.rejectedByCohostType = moderator.cohostType;
    poll.rejectedByName = moderator.actorName;
    poll.rejectedAt = new Date();
    poll.rejectionReason = reason;

    // Remove from activePolls so it's not shown to students
    this.activePolls.delete(pollId);
    this.clearScheduledLaunch(pollId);

    await room.save();

    // Emit event to notify rejection
    pollSocket?.emitToRoom(roomCode, 'question-rejected', {
      pollId,
      reason: reason || 'No reason provided',
      rejectedBy: userId,
      rejectedByType: moderator.actorType,
      rejectedByName: moderator.actorName,
    });

    await pollSocket.emitRoomDashboardUpdates(roomCode);

    return {
      message: 'Poll rejected successfully'
    };
  }

}
