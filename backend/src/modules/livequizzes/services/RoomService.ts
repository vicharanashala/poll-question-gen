import { injectable } from 'inversify';
import { Room } from '../../../shared/database/models/Room.js';
import type {
  Room as RoomType,
  RoomStudent,
  Poll,
  PollAnswer,
  CohostJwtPayload,
  GuestCohostJwtPayload,
  GetCohostRoom,
  ActiveCohost,
  CohostType,
  ModerationActorType,
} from '../interfaces/PollRoom.js';
import { UserModel } from '../../../shared/database/models/User.js';
import { ObjectId } from 'mongodb';
import { HttpError, NotFoundError } from 'routing-controllers';
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { pollSocket } from '../utils/PollSocket.js';
import { appConfig } from '../../../config/app.js';

type ModeratorContext = {
  actorId: string;
  actorType: ModerationActorType;
  cohostType?: CohostType;
  actorName: string;
};

@injectable()
export class RoomService {
  private userModel = UserModel;
  private roomModel = Room;

  private getInviteBaseUrl(): string {
    return appConfig.publicUrl.replace(/\/+$/, '');
  }

  private getTeacherCohostSecret(): string {
    const secret = process.env.COHOST_INVITE_SECRET;
    if (!secret) {
      throw new Error('COHOST_INVITE_SECRET is not configured');
    }
    return secret;
  }

  private getGuestCohostSecret(): string {
    const secret = process.env.GUEST_COHOST_INVITE_SECRET || process.env.COHOST_INVITE_SECRET;
    if (!secret) {
      throw new Error('GUEST_COHOST_INVITE_SECRET is not configured');
    }
    return secret;
  }

  private getGuestInviteTtlMinutes(): number {
    const ttl = Number(process.env.GUEST_COHOST_INVITE_TTL_MINUTES || 180);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 180;
  }

  private async resolveModeratorContext(room: any, actorId: string): Promise<ModeratorContext> {
    if (room.teacherId === actorId) {
      const host = await this.userModel.findOne({ firebaseUID: actorId }, 'firstName lastName').lean();
      const actorName = host
        ? `${host.firstName || ''} ${host.lastName || ''}`.trim() || room.teacherName || 'Host'
        : room.teacherName || 'Host';

      return {
        actorId,
        actorType: 'host',
        actorName,
      };
    }

    const cohost = room.coHosts.find((c: any) => c.userId?.toString() === actorId && c.isActive);
    if (!cohost) {
      throw new HttpError(403, 'Only host or cohost can perform this action');
    }

    const cohostType: CohostType = (cohost.type as CohostType) || 'teacher';
    if (cohostType === 'guest') {
      return {
        actorId,
        actorType: 'cohost',
        cohostType,
        actorName: cohost.displayName || 'Guest Cohost',
      };
    }

    const user = await this.userModel.findOne({ firebaseUID: actorId }, 'firstName lastName').lean();
    const actorName = user
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Cohost'
      : cohost.displayName || 'Cohost';

    return {
      actorId,
      actorType: 'cohost',
      cohostType,
      actorName,
    };
  }

  async createRoom(name: string, teacherId: string): Promise<RoomType> {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const teachername = await this.userModel.findOne({ firebaseUID: teacherId }).lean();
    const newRoom = await new Room({
      roomCode: code,
      name,
      teacherId,
      teacherName: `${teachername?.firstName} ${teachername?.lastName}`.trim(),
      createdAt: new Date(),
      status: 'active',
      polls: []
    }).save();

    return this.mapRoom(newRoom.toObject());  // return plain object
  }

  async getRoomByCode(code: string): Promise<RoomType | null> {
    const room = await Room.findOne({ roomCode: code }).populate('students', 'firstName email firebaseUID').lean();
    return room ? this.mapRoom(room) : null;
  }

  async getRoomsByTeacher(teacherId: string, status?: 'active' | 'ended'): Promise<RoomType[]> {
    const query: any = { teacherId };
    if (status) {
      query.status = status;
    }
    const rooms = await Room.find(query).sort({ createdAt: -1 }).lean();
    return rooms.map(room => this.mapRoom(room));
  }

  async getUsersByIds(userIds: string[]) {
    return await this.userModel.find(
      { uid: { $in: userIds } },
      'uid name'
    ).lean();
  }

  async getPollAnalysis(roomCode: string) {
    // 1️⃣ Find the room by code
    const room = await this.roomModel.findOne({ roomCode }).lean();
    if (!room) throw new Error('Room not found');

    const participantsMap = new Map<string, {
      userId: string;
      correct: number;
      wrong: number;
      score: number;
      timeTaken: number;
    }>();

    // 1.1️⃣ Initialize map with all enrolled students (fetching their Firebase UIDs)
    if (room.students && room.students.length > 0) {
      const enrolledUsers = await this.userModel.find({ _id: { $in: room.students } }, 'firebaseUID').lean();
      for (const user of enrolledUsers) {
        if (user.firebaseUID) {
          participantsMap.set(user.firebaseUID, {
            userId: user.firebaseUID,
            correct: 0,
            wrong: 0,
            score: 0,
            timeTaken: 0,
          });
        }
      }
    }

    // 2️⃣ Process each poll and answers
    for (const poll of room.polls) {
      for (const answer of poll.answers) {
        if (!participantsMap.has(answer.userId)) {
          // This case might still happen if a student answered but isn't in 'students' (unlikely but safe)
          participantsMap.set(answer.userId, {
            userId: answer.userId,
            correct: 0,
            wrong: 0,
            score: 0,
            timeTaken: 0,
          });
        }
        const participant = participantsMap.get(answer.userId)!;

        if (answer.answerIndex === poll.correctOptionIndex) {
          participant.correct += 1;
          participant.score += 5; // example scoring
        } else {
          participant.wrong += 1;
          participant.score -= 2;
        }

        // Calculate time taken for this answer (in seconds)
        const answerTime = (answer.answeredAt.getTime() - poll.createdAt.getTime()) / 1000;
        participant.timeTaken += answerTime;
      }
    }

    // 3️⃣ Fetch user names (THIS IS WHERE to add)
    const userIds = Array.from(participantsMap.keys());
    const users = await this.userModel.find({ firebaseUID: { $in: userIds } }, 'firebaseUID firstName').lean();

    // 4️⃣ Convert map to array and merge names
    const participants = Array.from(participantsMap.values()).map((p) => {
      const user = users.find(u => u.firebaseUID === p.userId);

      // Format time taken - convert seconds to minutes and seconds
      let timeDisplay = "N/A";
      if (p.timeTaken > 0) {
        const totalSeconds = Math.round(p.timeTaken);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes > 0) {
          timeDisplay = `${minutes}m ${seconds}s`;
        } else {
          timeDisplay = `${seconds}s`;
        }
      }

      return {
        name: user?.firstName ?? 'Anonymous',
        score: p.score,
        correct: p.correct,
        wrong: p.wrong,
        timeTaken: timeDisplay
      };
    });

    // Sort descending by score
    participants.sort((a, b) => b.score - a.score);

    // 5️⃣ Build question-level stats
    const questions = room.polls.map((poll) => ({
      text: poll.question,
      correctCount: poll.answers.filter(
        a => a.answerIndex === poll.correctOptionIndex
      ).length
    }));

    return {
      id: room._id,
      name: room.name,
      createdAt: room.createdAt,
      duration: room.endedAt && room.createdAt
        ? Math.ceil((room.endedAt.getTime() - room.createdAt.getTime()) / 60000) + ' mins'
        : 'N/A',
      participants,
      questions,
    };
  }

  async getRoomsByTeacherAndStatus(teacherId: string, status: 'active' | 'ended'): Promise<RoomType[]> {
    const rooms = await Room.find({ teacherId, status }).lean();
    return rooms.map(room => this.mapRoom(room));
  }

  async isRoomValid(code: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code }).lean();
    return !!room && room.status.toLowerCase() === 'active';
  }

  async isRoomEnded(code: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code }).lean();
    return room ? room.status === 'ended' : false;
  }

  async endRoom(code: string, teacherId: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code, teacherId });
    if (!room) {
      return false;
    }

    const endedAt = new Date();
    room.status = 'ended';
    room.endedAt = endedAt;
    room.recordingLock = null;

    if (room.coHostInvite) {
      room.coHostInvite.isActive = false;
      room.coHostInvite.expiresAt = endedAt;
    }

    if (room.guestCoHostInvite) {
      room.guestCoHostInvite.isActive = false;
      room.guestCoHostInvite.expiresAt = endedAt;
    }

    room.coHosts.forEach(c => {
      c.isActive = false;
    });

    await room.save();

    pollSocket?.emitToRoom(code, 'room-ended', {
      message: 'Room has ended'
    });
    await pollSocket?.emitRoomDashboardUpdates(code);
    return true;
  }

  async canJoinRoom(code: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code }).lean();
    return !!room && room.status === 'active';
  }

  async getAllRooms(): Promise<RoomType[]> {
    const rooms = await Room.find().lean();
    return rooms.map(room => this.mapRoom(room));
  }

  async getActiveRooms(): Promise<RoomType[]> {
    const rooms = await Room.find({ status: 'active' }).lean();
    return rooms.map(room => this.mapRoom(room));
  }

  async getEndedRooms(): Promise<RoomType[]> {
    const rooms = await Room.find({ status: 'ended' }).lean();
    return rooms.map(room => this.mapRoom(room));
  }
  /**
   * Map Mongoose Room Document to plain RoomType matching interface
   */
  private mapRoom(roomDoc: any): RoomType {
    const students: RoomStudent[] = (roomDoc.students || [])
      .map((student: any): RoomStudent | null => {
        if (!student) {
          return null;
        }

        if (typeof student === 'string') {
          return { id: student };
        }

        const mongoId =
          typeof student._id === 'string'
            ? student._id
            : student._id?.toString?.();

        const rawId = typeof student.toString === 'function' ? student.toString() : undefined;
        const firebaseUID = typeof student.firebaseUID === 'string' ? student.firebaseUID : undefined;
        const normalizedId = firebaseUID || mongoId || rawId;

        if (!normalizedId || normalizedId === '[object Object]') {
          return null;
        }

        return {
          id: normalizedId,
          firebaseUID,
          firstName: typeof student.firstName === 'string' ? student.firstName : undefined,
          email: typeof student.email === 'string' ? student.email : undefined,
        };
      })
      .filter((student): student is RoomStudent => Boolean(student?.id));

    return {
      roomCode: roomDoc.roomCode,
      name: roomDoc.name,
      teacherId: roomDoc.teacherId,
      createdAt: roomDoc.createdAt,
      endedAt: roomDoc.endedAt,
      status: roomDoc.status,
      totalStudents: new Set(students.map(student => student.id)).size,
      students,
      joinedStudents: roomDoc.joinedStudents || [],
      coHosts: roomDoc.coHosts,
      controls: roomDoc.controls || { micBlocked: false, pollRestricted: false },
      polls: (roomDoc.polls || []).map((p: any): Poll => ({
        _id: p._id.toString(),  // convert ObjectId to string if needed
        question: p.question,
        options: p.options,
        correctOptionIndex: p.correctOptionIndex,
        timer: p.timer,
        maxPoints: p.maxPoints,
        scheduledAt: p.scheduledAt,
        isLaunched: p.isLaunched,
        launchedAt: p.launchedAt,
        createdAt: p.createdAt,
        approvalStatus: p.approvalStatus,
        approvedBy: p.approvedBy,
        approvedByType: p.approvedByType,
        approvedByCohostType: p.approvedByCohostType,
        approvedByName: p.approvedByName,
        rejectedBy: p.rejectedBy,
        rejectedByType: p.rejectedByType,
        rejectedByCohostType: p.rejectedByCohostType,
        rejectedByName: p.rejectedByName,
        rejectedAt: p.rejectedAt,
        rejectionReason: p.rejectionReason,
        approvedAt: p.approvedAt,
        answers: (p.answers || []).map((a: any): PollAnswer => ({
          userId: a.userId,
          answerIndex: a.answerIndex,
          answeredAt: a.answeredAt
        }))
      }))
    };
  }


  async enrollStudent(userId: string, roomCode: string, firebaseUID: string) {
    const room = await Room.findOne({ roomCode })
    if (!room) {
      throw new NotFoundError("Room is not found")
    }
    const userObjectId = new ObjectId(userId)
    // const existingStudent = await Room.findOne({students:{$in:[userObjectId]}})
    const isAlreadyEnrolled = room.students.some((id) => id.equals(userObjectId))
    if (isAlreadyEnrolled) {
      console.log("User Already enrolled in the course")
      return room
    }
    const updatedRoom = await Room.findOneAndUpdate({ roomCode }, { $addToSet: { students: userObjectId, joinedStudents: firebaseUID } }, { new: true })
    return updatedRoom
  }


  async unEnrollStudent(userId: string, roomCode: string) {
    if (!userId) return;
    const room = await Room.findOne({ roomCode })
    if (!room) {
      throw new NotFoundError("Room is not found")
    }
    const userObjectId = new ObjectId(userId)
    const isAlreadyEnrolled = room.students.some((id) => id.equals(userObjectId))
    if (!isAlreadyEnrolled) {
      console.log("User Not enrolled in the course")
      return room
    }
    const updatedRoom = await Room.findOneAndUpdate({ roomCode }, { $pull: { students: userObjectId } }, { new: true })
    return updatedRoom
  }

  // Recording lock management
  async acquireRecordingLock(
    roomCode: string,
    userId: string,
    userName?: string
  ): Promise<{ success: boolean; message: string; currentRecorder?: { userId: string; userName?: string } }> {
    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError("Room is not found");
    }

    if (room.status !== 'active') {
      return {
        success: false,
        message: 'Room is not active',
      };
    }

    const isAuthorized = await this.isUserTeacherOrCohost(userId, roomCode);
    if (!isAuthorized) {
      throw new HttpError(403, 'Only host or cohost can use the microphone');
    }

    const moderatorContext = await this.resolveModeratorContext(room, userId);

    const activeCohost = room.coHosts.find(
      c => c.userId.toString() === userId && c.isActive
    );

    if (activeCohost?.isMicMuted) {
      return {
        success: false,
        message: "Host has muted your microphone"
      };
    }

    // Check if recording lock exists and is still valid
    if (room.recordingLock) {
      const now = new Date();
      // If lock hasn't expired and it's not the same user, deny access
      if (room.recordingLock.expiresAt && room.recordingLock.expiresAt > now && room.recordingLock.userId !== userId) {
        return {
          success: false,
          message: `Recording is in use by ${room.recordingLock.userName || 'another user'}`,
          currentRecorder: {
            userId: room.recordingLock.userId,
            userName: room.recordingLock.userName
          }
        };
      }
    }
    // Acquire the lock with 30 minute timeout
    const lockExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await Room.updateOne(
      { roomCode },
      {
        recordingLock: {
          userId,
          userName: userName || moderatorContext.actorName,
          lockedAt: new Date(),
          expiresAt: lockExpiresAt
        }
      }
    );

    // Notify all users in the room that recording has started
    pollSocket?.emitToRoom(roomCode, 'recording-started', {
      userId,
      userName: userName || moderatorContext.actorName
    });

    return {
      success: true,
      message: "Recording lock acquired"
    };
  }

  async releaseRecordingLock(roomCode: string, userId: string): Promise<{ success: boolean; message: string }> {
    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError("Room is not found");
    }

    // Only allow the user who acquired the lock to release it
    if (room.recordingLock && room.recordingLock.userId !== userId) {
      throw new HttpError(403, "Only the user who started recording can stop it");
    }

    // Release the lock
    await Room.updateOne(
      { roomCode },
      {
        recordingLock: null
      }
    );

    // Notify all users in the room that recording has stopped
    pollSocket?.emitToRoom(roomCode, 'recording-stopped', {
      userId
    });

    return {
      success: true,
      message: "Recording lock released"
    };
  }

  async getRecordingLockStatus(roomCode: string): Promise<{ isLocked: boolean; currentRecorder?: { userId: string; userName?: string; lockedSince: Date } }> {
    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError("Room is not found");
    }

    if (!room.recordingLock) {
      return { isLocked: false };
    }

    const now = new Date();
    if (room.recordingLock.expiresAt && room.recordingLock.expiresAt <= now) {
      // Lock has expired, clear it
      await Room.updateOne({ roomCode }, { recordingLock: null });
      return { isLocked: false };
    }

    return {
      isLocked: true,
      currentRecorder: {
        userId: room.recordingLock.userId,
        userName: room.recordingLock.userName,
        lockedSince: room.recordingLock.lockedAt
      }
    };
  }

  //generate cohost invite
  async generateCohostInvite(roomCode: string, userId: string): Promise<string> {

    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError("Room is not found")
    }

    if (room.teacherId.toString() !== userId) {
      throw new HttpError(403, "Only host can generate invite")
    }

    const inviteId = uuidv4();

    const token = jwt.sign(
      {
        roomId: room.roomCode,
        jti: inviteId,
        type: 'teacher-cohost'
      },
      this.getTeacherCohostSecret(),
      { expiresIn: "30m" }
    );

    room.coHostInvite = {
      createdAt: new Date(Date.now()),
      inviteId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      isActive: true
    };

    await room.save();

    const inviteBaseUrl = this.getInviteBaseUrl();
    return `${inviteBaseUrl}/teacher/cohost-invite/${token}`

  }

  async generateGuestCohostInvite(roomCode: string, userId: string): Promise<{ inviteLink: string; expiresAt: Date }> {
    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError('Room is not found');
    }

    if (room.teacherId.toString() !== userId) {
      throw new HttpError(403, 'Only host can generate invite');
    }

    if (room.status !== 'active') {
      throw new HttpError(400, 'Invite can be generated only for active rooms');
    }

    const inviteId = uuidv4();
    const ttlMinutes = this.getGuestInviteTtlMinutes();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const token = jwt.sign(
      {
        roomId: room.roomCode,
        jti: inviteId,
        type: 'guest-cohost'
      },
      this.getGuestCohostSecret(),
      { expiresIn: `${ttlMinutes}m` }
    );

    room.guestCoHostInvite = {
      createdAt: new Date(Date.now()),
      inviteId,
      expiresAt,
      isActive: true
    };

    await room.save();

    const inviteBaseUrl = this.getInviteBaseUrl();
    return {
      inviteLink: `${inviteBaseUrl}/guest-cohost-invite/${token}`,
      expiresAt,
    };

  }

  //join as cohost
  async joinAsCohost(token: string, userId: string): Promise<{ message: string, roomId: string }> {

    const decoded = jwt.verify(
      token,
      this.getTeacherCohostSecret()
    ) as CohostJwtPayload;

    const room = await Room.findOne({ roomCode: decoded.roomId });
    if (!room || room.status !== "active") {
      throw new HttpError(400, "Invalid room")
    }
    if (
      !room.coHostInvite?.isActive ||
      room.coHostInvite?.inviteId !== decoded.jti ||
      !room.coHostInvite?.expiresAt ||
      room.coHostInvite.expiresAt < new Date()
    ) {
      throw new HttpError(400, "Invite invalid or expired")
    }

    if (room.teacherId === userId) {
      throw new HttpError(400, "Host cannot join as cohost");
    }

    const user = await UserModel.findOne({
      firebaseUID:
        userId
    });
    if (user.role !== "teacher") {
      throw new HttpError(403, "Only teachers allowed")
    }

    const already = room.coHosts.find(
      c => c.userId.toString() === userId && c.isActive
    );

    if (!already) {
      room.coHosts.push({
        userId,
        addedBy: room.teacherId,
        type: 'teacher',
        displayName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
      });
    }

    await room.save();

    // Get updated cohost list with full details
    const activeCohosts = await this.getRoomCohosts(room.teacherId, decoded.roomId);
    pollSocket?.emitToRoom(decoded.roomId, 'cohost-joined', {
      activeCohosts: activeCohosts
    });

    return { message: "Joined as cohost", roomId: room.roomCode }

  }

  async joinAsGuestCohost(token: string, displayName: string): Promise<{ message: string; roomId: string; cohostId: string; displayName: string }> {
    const cleanDisplayName = (displayName || '').trim();
    if (!cleanDisplayName) {
      throw new HttpError(400, 'Display name is required');
    }

    const decoded = jwt.verify(token, this.getGuestCohostSecret()) as GuestCohostJwtPayload;
    if (decoded.type !== 'guest-cohost') {
      throw new HttpError(400, 'Invalid guest invite token');
    }

    const room = await Room.findOne({ roomCode: decoded.roomId });
    if (!room || room.status !== 'active') {
      throw new HttpError(400, 'Invalid room');
    }

    if (
      !room.guestCoHostInvite?.isActive ||
      room.guestCoHostInvite?.inviteId !== decoded.jti ||
      !room.guestCoHostInvite?.expiresAt ||
      room.guestCoHostInvite.expiresAt < new Date()
    ) {
      throw new HttpError(400, 'Invite invalid or expired');
    }

    const cohostId = `guest-${uuidv4()}`;
    room.coHosts.push({
      userId: cohostId,
      sessionId: cohostId,
      addedBy: room.teacherId,
      type: 'guest',
      displayName: cleanDisplayName,
      isActive: true,
      isMicMuted: false,
    });

    await room.save();

    const activeCohosts = await this.getRoomCohosts(room.teacherId, decoded.roomId);
    pollSocket?.emitToRoom(decoded.roomId, 'cohost-joined', {
      activeCohosts
    });

    return {
      message: 'Joined as cohost',
      roomId: room.roomCode,
      cohostId,
      displayName: cleanDisplayName,
    };
  }

  //get cohost rooms
  async getCohostedRooms(userId: string): Promise<GetCohostRoom> {

    const rooms = await Room.aggregate([
      {
        $match: {
          coHosts: {
            $elemMatch: {
              userId: userId,
              isActive: true
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          let: { teacherId: "$teacherId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$firebaseUID", "$$teacherId"] }
              }
            },
            {
              $project: {
                _id: 0,
                firstName: 1,
                lastName: 1
              }
            }
          ],
          as: "teacher"
        }
      },
      {
        $unwind: {
          path: "$teacher",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          totalStudents: {
            $size: {
              $setUnion: [{ $ifNull: ["$students", []] }, []]
            }
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);
    return { count: rooms.length, rooms }
  }

  //get room cohost
  async getRoomCohosts(host: string, roomCode: string): Promise<ActiveCohost[]> {
    const room = await Room.findOne({ roomCode, teacherId: host }).lean();
    if (!room) {
      return [];
    }

    const activeCohosts = (room.coHosts || []).filter((c: any) => c.isActive);
    if (!activeCohosts.length) {
      return [];
    }

    const teacherCohostIds = activeCohosts
      .filter((c: any) => (c.type || 'teacher') === 'teacher')
      .map((c: any) => c.userId);

    const teacherUsers = teacherCohostIds.length
      ? await UserModel.find(
        { firebaseUID: { $in: teacherCohostIds } },
        'firebaseUID firstName lastName email'
      ).lean()
      : [];

    const userMap = new Map(teacherUsers.map((u: any) => [u.firebaseUID, u]));

    return activeCohosts.map((cohost: any) => {
      const cohostType: CohostType = cohost.type || 'teacher';
      if (cohostType === 'guest') {
        return {
          userId: cohost.userId,
          displayName: cohost.displayName || 'Guest Cohost',
          addedAt: cohost.addedAt,
          type: 'guest',
          isMicMuted: cohost.isMicMuted,
        };
      }

      const user = userMap.get(cohost.userId);
      return {
        userId: cohost.userId,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || cohost.email || '',
        displayName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || cohost.displayName || 'Cohost',
        addedAt: cohost.addedAt,
        type: 'teacher',
        isMicMuted: cohost.isMicMuted,
      };
    });
  }

  //remove cohost
  async removeCohost(roomCode: string, userId: string, teacherId: string): Promise<{ message: string }> {

    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError("Room is not found")
    }
    if (room.teacherId !== teacherId) {
      throw new HttpError(400, "Invalid room")
    }
    room.coHosts.forEach(c => {
      if (c.userId?.toString() === userId) {
        c.isActive = false;
      }
    });
    await room.save();
    // Get updated cohost list
    const activeCohosts = await this.getRoomCohosts(teacherId, roomCode);
    pollSocket?.emitToRoom(roomCode, 'cohost-removed', {
      removedUserId: userId,
      activeCohosts: activeCohosts
    });
    return { message: 'coHost removed successfully' }
  }

  //mute cohost mic 
  async setCohostMicMuted(
    roomCode: string,
    teacherId: string,
    userId: string,
    isMicMuted: boolean
  ): Promise<{ message: string; isMicMuted: boolean }> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room is not found");
    if (room.teacherId !== teacherId) {
      throw new HttpError(403, "Only host can manage co-host microphone");
    }

    const cohost = room.coHosts.find(c => c.userId === userId && c.isActive);
    if (!cohost) throw new NotFoundError("Active co-host not found");

    cohost.isMicMuted = isMicMuted;

    let lockReleased = false;
    if (isMicMuted && room.recordingLock?.userId === userId) {
      room.recordingLock = null;
      lockReleased = true;
    }

    await room.save();
    if (lockReleased) {
      pollSocket?.emitToRoom(roomCode, "recording-stopped", { userId });
    }

    const activeCohosts = await this.getRoomCohosts(teacherId, roomCode);
    pollSocket?.emitToRoom(roomCode, "cohost-mic-updated", {
      cohostId: userId,
      isMicMuted,
      activeCohosts
    });

    return {
      message: isMicMuted ? "Co-host microphone muted" : "Co-host microphone unmuted",
      isMicMuted
    };
  }
  // Update room controls (Mic, Poll restrictions) and emit to clients
  async updateRoomControls(
    roomCode: string,
    userId: string,
    controlsUpdate: { micBlocked?: boolean; pollRestricted?: boolean }
  ): Promise<{ message: string; controls: any }> {

    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError("Room is not found");
    }

    if (room.teacherId !== userId) {
      throw new HttpError(403, 'Only host can update room controls');
    }

    // Update the controls if they are provided in the request
    if (controlsUpdate.micBlocked !== undefined) {
      room.controls.micBlocked = controlsUpdate.micBlocked;
    }
    if (controlsUpdate.pollRestricted !== undefined) {
      room.controls.pollRestricted = controlsUpdate.pollRestricted;
    }
    await room.save()
    // EMIT TO FRONTEND
    pollSocket?.emitToRoom(roomCode, 'roomControlsUpdated', {
      micBlocked: room.controls.micBlocked,
      pollRestricted: room.controls.pollRestricted
    });

    return {
      message: 'Room controls updated successfully',
      controls: room.controls
    };
  }

  // PHASE 1: Permission Model Enhancement
  // Utility method to check if user is teacher or active cohost
  async isUserSpeakerOrModerator(userId: string, roomCode: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode });
    if (!room) return false;

    if (room.status !== 'active') {
      return false;
    }

    // Check if user is the teacher (host)
    if (room.teacherId === userId) {
      return true;
    }

    // Check if user is an active cohost
    const isActiveCohost = room.coHosts.some(
      c => c.userId?.toString() === userId && c.isActive
    );

    return isActiveCohost;
  }

  // Check if user has moderation permissions (teacher or active cohost)
  async isUserTeacherOrCohost(userId: string, roomCode: string): Promise<boolean> {
    return this.isUserSpeakerOrModerator(userId, roomCode);
  }

  // PHASE 2: Question Approval Workflow Methods
  async toggleQuestionApprovalSetting(
    roomCode: string,
    userId: string,
    required: boolean
  ): Promise<{ message: string; questionApprovalRequired: boolean }> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");

    // Only teacher/host can change this setting
    if (room.teacherId !== userId) {
      throw new HttpError(403, "Only host can change approval settings");
    }

    room.questionApprovalRequired = required;
    await room.save();

    pollSocket?.emitToRoom(roomCode, 'approval-setting-changed', {
      questionApprovalRequired: required
    });

    return {
      message: `Question approval ${required ? 'enabled' : 'disabled'}`,
      questionApprovalRequired: required
    };
  }

  async requiresApproval(roomCode: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");
    return room.questionApprovalRequired;
  }

  async getPendingQuestions(roomCode: string): Promise<Poll[]> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");

    // Filter polls with pending approval status
    const pendingPolls = room.polls.filter(poll => poll.approvalStatus === 'pending');
    return pendingPolls;
  }

  // PHASE 3: Student Management Methods
  async muteStudent(
    roomCode: string,
    studentId: string,
    userId: string
  ): Promise<{ message: string; isMuted: boolean }> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");
    if (room.status !== 'active') {
      throw new HttpError(400, 'Room is not active');
    }

    // Check if user has moderation permissions
    const isAuthorized = await this.isUserTeacherOrCohost(userId, roomCode);
    if (!isAuthorized) {
      throw new HttpError(403, "Only host or cohost can mute students");
    }

    const moderator = await this.resolveModeratorContext(room, userId);

    // Check if student is already muted
    const alreadyMuted = room.mutedStudents.some(m => m.studentId === studentId);
    if (!alreadyMuted) {
      room.mutedStudents.push({
        studentId,
        mutedBy: userId,
        mutedByType: moderator.actorType,
        mutedByName: moderator.actorName,
        mutedAt: new Date()
      });
    }

    await room.save();

    // Emit events
    pollSocket?.emitToRoom(roomCode, 'student-muted', {
      studentId,
      mutedBy: userId,
      mutedByType: moderator.actorType,
      mutedByName: moderator.actorName,
      mutedAt: new Date()
    });

    pollSocket?.emitToSocket(studentId, 'you-have-been-muted', {
      mutedBy: userId
    });

    return {
      message: 'Student muted successfully',
      isMuted: true
    };
  }

  async unmuteStudent(
    roomCode: string,
    studentId: string,
    userId: string
  ): Promise<{ message: string; isMuted: boolean }> {
    const room = await Room.findOne({ roomCode });
    if (!room) throw new NotFoundError("Room not found");
    if (room.status !== 'active') {
      throw new HttpError(400, 'Room is not active');
    }

    // Check if user has moderation permissions
    const isAuthorized = await this.isUserTeacherOrCohost(userId, roomCode);
    if (!isAuthorized) {
      throw new HttpError(403, "Only host or cohost can unmute students");
    }

    const moderator = await this.resolveModeratorContext(room, userId);

    // Remove from muted students
    const mutedEntryIndex = room.mutedStudents.findIndex(m => m.studentId === studentId);
    if (mutedEntryIndex !== -1) {
      room.mutedStudents.splice(mutedEntryIndex, 1);
    }
    await room.save();

    // Emit events
    pollSocket?.emitToRoom(roomCode, 'student-unmuted', {
      studentId,
      unmutedBy: userId,
      unmutedByType: moderator.actorType,
      unmutedByName: moderator.actorName,
    });

    pollSocket?.emitToSocket(studentId, 'you-have-been-unmuted', {});

    return {
      message: 'Student unmuted successfully',
      isMuted: false
    };
  }

  async isStudentMuted(roomCode: string, studentId: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode });
    if (!room) return false;

    return room.mutedStudents.some(m => m.studentId === studentId);
  } 
}
