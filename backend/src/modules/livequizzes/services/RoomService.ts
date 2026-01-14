import { injectable } from 'inversify';
import { Room } from '../../../shared/database/models/Room.js';
import type { Room as RoomType, Poll, PollAnswer } from '../interfaces/PollRoom.js';
import { UserModel } from '../../../shared/database/models/User.js';
import {ObjectId} from 'mongodb'
import { NotFoundError } from 'routing-controllers';

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

    return newRoom.toObject();  // return plain object
  }

  async getRoomByCode(code: string): Promise<RoomType | null> {
    return await Room.findOne({ roomCode: code }).populate('students','firstName email').lean()
  }

  async getRoomsByTeacher(teacherId: string, status?: 'active' | 'ended'): Promise<RoomType[]> {
    const query: any = { teacherId };
    if (status) {
      query.status = status;
    }
    return await Room.find(query).sort({ createdAt: -1 }).lean();
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

    // 2️⃣ Process each poll and answers
    for (const poll of room.polls) {
      for (const answer of poll.answers) {
        if (!participantsMap.has(answer.userId)) {
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

        // optional: compute timeTaken if you want, using answer.answeredAt - poll.createdAt
      }
    }

    // 3️⃣ Fetch user names (THIS IS WHERE to add)
    const userIds = Array.from(participantsMap.keys());
    const users = await this.userModel.find({ firebaseUID: { $in: userIds } }, 'firebaseUID firstName').lean();

    // 4️⃣ Convert map to array and merge names
    const participants = Array.from(participantsMap.values()).map((p) => {
      const user = users.find(u => u.firebaseUID === p.userId);
      return {
        name: user?.firstName ?? 'Anonymous',
        score: p.score,
        correct: p.correct,
        wrong: p.wrong,
        timeTaken: p.timeTaken > 0 ? `${Math.ceil(p.timeTaken / 60)} min` : "N/A"
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
    return await Room.find({ teacherId, status }).lean();
  }

  async isRoomValid(code: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code }).lean();
    return !!room && room.status.toLowerCase() === 'active';
  }

  async isRoomEnded(code: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code }).lean();
    return room ? room.status === 'ended' : false;
  }

  async endRoom(code: string): Promise<boolean> {
    const updated = await Room.findOneAndUpdate({ roomCode: code }, { status: 'ended' }, { new: true }).lean();
    return !!updated;
  }

  async canJoinRoom(code: string): Promise<boolean> {
    const room = await Room.findOne({ roomCode: code }).lean();
    return !!room && room.status === 'active';
  }

  async getAllRooms(): Promise<RoomType[]> {
    return await Room.find().lean();
  }

  async getActiveRooms(): Promise<RoomType[]> {
    return await Room.find({ status: 'active' }).lean();
  }

  async getEndedRooms(): Promise<RoomType[]> {
    return await Room.find({ status: 'ended' }).lean();
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
      status: roomDoc.status,
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


  async enrollStudent(userId:string,roomCode:string){
    const room = await Room.findOne({roomCode})
    if(!room){
      throw new NotFoundError("Room is not found")
    }
    const userObjectId=new ObjectId(userId)
    // const existingStudent = await Room.findOne({students:{$in:[userObjectId]}})
    const isAlreadyEnrolled = room.students.some((id) => id.equals(userObjectId))
    if(isAlreadyEnrolled){
      console.log("User Already enrolled in the course")
      return room
    }
    const updatedRoom = await Room.findOneAndUpdate({roomCode},{$addToSet:{students:userObjectId}},{new:true})
    return updatedRoom
  }

  async unEnrollStudent(userId:string,roomCode:string){
    const room = await Room.findOne({roomCode})
    if(!room){
      throw new NotFoundError("Room is not found")
    }
    const userObjectId=new ObjectId(userId)
    const isAlreadyEnrolled = room.students.some((id) => id.equals(userObjectId))
    if(!isAlreadyEnrolled){
      console.log("User Not enrolled in the course")
      return room
    }
    const updatedRoom = await Room.findOneAndUpdate({roomCode},{$pull:{students:userObjectId}},{new:true})
    return updatedRoom
  }

  /**
   * Switch question generation mode for a room
   * Only the teacher/host can switch modes
   */
  async setQuestionMode(roomCode: string, mode: 'manual' | 'auto' | 'paused', teacherId: string): Promise<RoomType | null> {
    const room = await Room.findOne({ roomCode }).lean();
    if (!room) {
      throw new NotFoundError('Room not found');
    }

    // Verify that the user is the teacher
    if (room.teacherId !== teacherId) {
      throw new Error('Only the room host can change question mode');
    }

    const updatedRoom = await Room.findOneAndUpdate(
      { roomCode },
      { questionMode: mode },
      { new: true }
    ).lean();

    return updatedRoom;
  }

  /**
   * Get current question mode for a room
   */
  async getQuestionMode(roomCode: string): Promise<string | null> {
    const room = await Room.findOne({ roomCode }).lean();
    return room ? (room.questionMode || 'manual') : null;
  }
}
