import { injectable } from 'inversify';
import { Room } from '../../../shared/database/models/Room.js';
import type { Room as RoomType, Poll, PollAnswer, CohostJwtPayload, GetCohostRoom, ActiveCohost } from '../interfaces/PollRoom.js';
import { UserModel } from '../../../shared/database/models/User.js';
import { ObjectId } from 'mongodb';
import { HttpError, NotFoundError } from 'routing-controllers';
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { pollSocket } from '../utils/PollSocket.js';

@injectable()
export class RoomService {
  private userModel = UserModel;
  private roomModel = Room;
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
    const room = await Room.findOne({ roomCode: code }).populate('students', 'firstName email').lean();
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

    const totalStudentsInRoom = room.students?.length || 0;

    const participantsMap = new Map<string, {
      userId: string;
      correct: number;
      wrong: number;
      score: number;
      totalTimeTaken: number;
      questionsAttempted: number;
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
            totalTimeTaken: 0,
            questionsAttempted: 0,
          });
        }
      }
    }

    // 2️⃣ Process each poll and answers — use actual stored points
    let totalPointsDistributed = 0;
    for (const poll of room.polls) {
      for (const answer of poll.answers) {
        if (!participantsMap.has(answer.userId)) {
          participantsMap.set(answer.userId, {
            userId: answer.userId,
            correct: 0,
            wrong: 0,
            score: 0,
            totalTimeTaken: 0,
            questionsAttempted: 0,
          });
        }
        const participant = participantsMap.get(answer.userId)!;

        // Use ACTUAL stored points (set by calculateScore at submission time)
        const earnedPoints = answer.points ?? 0;
        participant.score += earnedPoints;
        totalPointsDistributed += earnedPoints;
        participant.questionsAttempted += 1;

        if (answer.answerIndex === poll.correctOptionIndex) {
          participant.correct += 1;
        } else {
          participant.wrong += 1;
        }

        // Calculate time taken for this answer (in seconds)
        const answerTime = (answer.answeredAt.getTime() - poll.createdAt.getTime()) / 1000;
        participant.totalTimeTaken += answerTime;
      }
    }

    // 3️⃣ Fetch user names
    const userIds = Array.from(participantsMap.keys());
    const users = await this.userModel.find({ firebaseUID: { $in: userIds } }, 'firebaseUID firstName lastName').lean();

    // 4️⃣ Convert map to array and merge names
    const participants = Array.from(participantsMap.values()).map((p) => {
      const user = users.find(u => u.firebaseUID === p.userId);
      const fullName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous';

      // Average response time (not cumulative sum)
      const avgResponseTimeSec = p.questionsAttempted > 0 ? p.totalTimeTaken / p.questionsAttempted : 0;

      // Format avg time
      let avgTimeDisplay = "N/A";
      if (avgResponseTimeSec > 0) {
        const totalSeconds = Math.round(avgResponseTimeSec);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        avgTimeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      }

      // Format total time
      let totalTimeDisplay = "N/A";
      if (p.totalTimeTaken > 0) {
        const totalSeconds = Math.round(p.totalTimeTaken);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        totalTimeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      }

      const accuracy = p.questionsAttempted > 0
        ? Math.round((p.correct / p.questionsAttempted) * 100)
        : 0;

      return {
        name: fullName,
        score: p.score,
        correct: p.correct,
        wrong: p.wrong,
        questionsAttempted: p.questionsAttempted,
        accuracy,
        timeTaken: totalTimeDisplay,
        avgResponseTime: avgTimeDisplay,
        avgResponseTimeSec: Math.round(avgResponseTimeSec * 10) / 10,
      };
    });

    // Sort descending by score
    participants.sort((a, b) => b.score - a.score);

    // 5️⃣ Build question-level stats with enhanced metrics
    const questions = room.polls.map((poll) => {
      const totalResponses = poll.answers.length;
      const correctCount = poll.answers.filter(
        a => a.answerIndex === poll.correctOptionIndex
      ).length;
      const correctPercentage = totalResponses > 0
        ? Math.round((correctCount / totalResponses) * 100)
        : 0;

      // Average answer time for this question
      let avgAnswerTimeSec = 0;
      if (totalResponses > 0) {
        const totalTime = poll.answers.reduce((sum, a) => {
          return sum + (a.answeredAt.getTime() - poll.createdAt.getTime()) / 1000;
        }, 0);
        avgAnswerTimeSec = Math.round((totalTime / totalResponses) * 10) / 10;
      }

      // Engagement & difficulty indicators
      const responseRate = totalStudentsInRoom > 0
        ? Math.round((totalResponses / totalStudentsInRoom) * 100)
        : 0;
      const isLowEngagement = responseRate < 50;
      const isHighDifficulty = correctPercentage < 30 && totalResponses > 0;

      return {
        text: poll.question,
        options: poll.options,
        correctOptionIndex: poll.correctOptionIndex,
        maxPoints: poll.maxPoints ?? 20,
        timer: poll.timer ?? 30,
        totalResponses,
        correctCount,
        correctPercentage,
        avgAnswerTimeSec,
        responseRate,
        isLowEngagement,
        isHighDifficulty,
      };
    });

    // 6️⃣ Scoring insights
    const allScores = participants.map(p => p.score);
    const scoringInsights = {
      totalPointsDistributed,
      avgPointsPerStudent: participants.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / participants.length)
        : 0,
      highestScore: allScores.length > 0 ? Math.max(...allScores) : 0,
      lowestScore: allScores.length > 0 ? Math.min(...allScores) : 0,
      scoringMethod: 'Time-based: points = maxPoints × (1 - responseTime/timer). Incorrect answers get 0 points.',
    };

    // 7️⃣ Proper participation rate
    const studentsWhoAnswered = participants.filter(p => p.questionsAttempted > 0).length;
    const participationRate = totalStudentsInRoom > 0
      ? Math.round((studentsWhoAnswered / totalStudentsInRoom) * 100)
      : 0;

    return {
      id: room._id,
      name: room.name,
      createdAt: room.createdAt,
      duration: room.endedAt && room.createdAt
        ? Math.ceil((room.endedAt.getTime() - room.createdAt.getTime()) / 60000) + ' mins'
        : 'N/A',
      totalStudents: totalStudentsInRoom,
      participationRate,
      participants,
      questions,
      scoringInsights,
    };
  }

  async getRoomsByTeacherAndStatus(teacherId: string, status: 'active' | 'ended'): Promise<RoomType[]> {
    const rooms = await Room.find({ teacherId, status }).lean();
    return rooms.map(room => this.mapRoom(room));
  }

  async isRoomValidAndHasAccess(code: string, userId: string): Promise<{ isActive: boolean; hasAccess: boolean;}> {

    const result = {isActive: true, hasAccess: false}
    const room = await Room.findOne({ roomCode: code }).lean();
    
    if (!room || room.status.toLowerCase() !== 'active') {
    result['isActive'] = false;
  }
  
  if(room.teacherId === userId ||
      room.coHosts?.some(coHost => coHost.userId === userId && coHost.isActive))result['hasAccess']=true
    return result;

  }

  async isRoomEnded(code: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code }).lean();
    return room ? room.status === 'ended' : false;
  }

  async endRoom(code: string, teacherId: string): Promise<boolean> {
    const updated = await Room.findOneAndUpdate({ roomCode: code, teacherId }, { status: 'ended', endedAt: new Date() }, { new: true }).lean();
    pollSocket?.emitToRoom(code, 'room-ended', {
      message: 'Room has ended'
    });
    return !!updated;
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
    return {
      roomCode: roomDoc.roomCode,
      name: roomDoc.name,
      teacherId: roomDoc.teacherId,
      createdAt: roomDoc.createdAt,
      endedAt: roomDoc.endedAt,
      status: roomDoc.status,
      students: roomDoc.students,
      // Safely handle populated objects (s._id) or raw strings
      totalStudents: new Set(roomDoc.students?.map((s: any) => s._id ? s._id.toString() : s.toString()) || []).size,
      coHosts: roomDoc.coHosts,
      controls: roomDoc.controls || { micBlocked: false, pollRestricted: false, autoGenEnabled: true },
      polls: (roomDoc.polls || []).map((p: any): Poll => ({
        _id: p._id.toString(),  // convert ObjectId to string if needed
        question: p.question,
        options: p.options,
        correctOptionIndex: p.correctOptionIndex,
        timer: p.timer,
        createdAt: p.createdAt,
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
          userName,
          lockedAt: new Date(),
          expiresAt: lockExpiresAt
        }
      }
    );

    // Notify all users in the room that recording has started
    pollSocket?.emitToRoom(roomCode, 'recording-started', {
      userId,
      userName
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
        jti: inviteId
      },
      process.env.COHOST_INVITE_SECRET,
      { expiresIn: "30m" }
    );

    room.coHostInvite = {
      createdAt: new Date(Date.now()),
      inviteId,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      isActive: true
    };

    await room.save();

    return `${process.env.APP_ORIGINS}/teacher/cohost-invite/${token}`

  }

  //join as cohost
  async joinAsCohost(token: string, userId: string): Promise<{ message: string, roomId: string }> {

    const decoded = jwt.verify(
      token,
      process.env.COHOST_INVITE_SECRET
    ) as CohostJwtPayload;
    const room = await Room.findOne({ roomCode: decoded.roomId });
    if (!room || room.status !== "active") {
      throw new HttpError(400, "Invalid room")
    }
    if (
      !room.coHostInvite.isActive ||
      room.coHostInvite.inviteId !== decoded.jti ||
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
        addedBy: room.teacherId
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

    const coHosts = await Room.aggregate<ActiveCohost>([
      {
        $match: {
          roomCode: roomCode,
          teacherId: host,
        }
      },
      {
        $unwind: "$coHosts"
      },
      {
        $match: {
          "coHosts.isActive": true
        }
      },
      {
        $lookup: {
          from: "users",
          let: { uid: "$coHosts.userId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$firebaseUID", "$$uid"] }
              }
            },
            {
              $project: {
                _id: 0,
                firebaseUID: 1,
                firstName: 1,
                lastName: 1,
                email: 1
              }
            }
          ],
          as: "cohostUser"
        }
      },
      {
        $unwind: "$cohostUser"
      },
      {
        $project: {
          _id: 0,
          userId: "$cohostUser.firebaseUID",
          firstName: "$cohostUser.firstName",
          lastName: "$cohostUser.lastName",
          email: "$cohostUser.email",
          addedAt: "$coHosts.addedAt",
          isMicMuted: "$coHosts.isMicMuted"
        }
      }
    ]);
    return coHosts
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
      if (c.userId === userId) {
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
    controlsUpdate: { micBlocked?: boolean; pollRestricted?: boolean; autoGenEnabled?: boolean }
  ): Promise<{ message: string; controls: any }> {

    const room = await Room.findOne({ roomCode });
    if (!room) {
      throw new NotFoundError("Room is not found");
    }

    // Update the controls if they are provided in the request
    if (controlsUpdate.micBlocked !== undefined) {
      room.controls.micBlocked = controlsUpdate.micBlocked;
    }
    if (controlsUpdate.pollRestricted !== undefined) {
      room.controls.pollRestricted = controlsUpdate.pollRestricted;
    }
    if (controlsUpdate.autoGenEnabled !== undefined) {
      room.controls.autoGenEnabled = controlsUpdate.autoGenEnabled;
    }
    await room.save()
    // EMIT TO FRONTEND
    pollSocket?.emitToRoom(roomCode, 'roomControlsUpdated', {
      micBlocked: room.controls.micBlocked,
      pollRestricted: room.controls.pollRestricted,
      autoGenEnabled: room.controls.autoGenEnabled
    });

    return {
      message: 'Room controls updated successfully',
      controls: room.controls
    };
  }
}
