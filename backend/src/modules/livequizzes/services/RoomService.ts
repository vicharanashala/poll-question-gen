import { injectable } from 'inversify';
import { Room } from '../../../shared/database/models/Room.js';
import type { Room as RoomType, Poll, PollAnswer, CohostJwtPayload, GetCohostRoom, ActiveCohost } from '../interfaces/PollRoom.js';
import { UserModel } from '../../../shared/database/models/User.js';
import { ObjectId } from 'mongodb';
import { HttpError, NotFoundError } from 'routing-controllers';
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { pollSocket } from '../utils/PollSocket.js';
import UserAchievements from '#root/shared/database/models/UserAchievement.js';

@injectable()
export class RoomService {
  private userModel = UserModel;
  private roomModel = Room;
  // debounce storage
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private triggerLiveOverviewUpdate(roomCode: string) {
    // Clear existing timer
    if (this.debounceTimers.has(roomCode)) {
      clearTimeout(this.debounceTimers.get(roomCode)!);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(roomCode);

      try {
        const overview = await this.getRoomAnalysisOverview(roomCode);

        if (overview) {
          pollSocket.emitToRoom(
            roomCode,
            'overview-analytics-updated',
            overview
          );
        }
      } catch (err) {
        console.error('Failed to retrieve overview:', err);
      }
    }, 2000);

    this.debounceTimers.set(roomCode, timer);
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
  }

  //room overview analysis
  async getRoomAnalysisOverview(roomCode: string) {

    const pipeline: any[] = [
      { $match: { roomCode } },
       {
                $project: {
                  roomCode: 1,
                  name: 1,
                  createdAt: 1,
                  status: 1,

                  totalStudents: { $size: '$joinedStudents' },
           totalCohosts: {
             $size: {
               $filter: {
                 input: { $ifNull: ['$coHosts', []] },
                 as: 'coHost',
                 cond: {
                   $and: [
                     { $ne: ['$$coHost', null] },
                     { $eq: ['$$coHost.isActive', true] }
                   ]
                 }
               }
             }
           },
                  questionsAsked: { $size: '$polls' },

                  pointsDistributed: {
                    $sum: {
                      $map: {
                        input: '$polls',
                        as: 'p',
                        in: { $ifNull: ['$$p.maxPoints', 0] }
                      }
                    }
                  },

                  earnedPoints: {
                    $sum: {
                      $map: {
                        input: '$polls',
                        as: 'poll',
                        in: { $sum: '$$poll.answers.points' }
                      }
                    }
                  },

                  avgAccuracy: {
                    $round: [
                      {
                        $cond: [
                          { $gt: [{ $size: '$polls' }, 0] },
                          {
                            $divide: [
                              { $sum: { $map: { input: '$polls', as: 'poll', in: { $sum: '$$poll.answers.points' } } } },
                              { $size: '$polls' }
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
    ]
    const roomOverview = await Room.aggregate(pipeline);
    if (!roomOverview.length) throw new Error('Room not found');
    console.log('overviewwwwwwwwwwwwwwwwwwwwwwwwwwwwwww:',roomOverview)
    return roomOverview[0];
  }
  //room questions analysis
  async getRoomAnalysisQuestions(
    roomCode: string,
     options?: {
      questionPage?: number;
      questionPageSize?: number;
    }
  ) {
    // Questions pagination
     const qPageSize = Number(options?.questionPageSize ?? 0);
      const qHasPagination = qPageSize > 0;
      const qPage  = qHasPagination ? Math.max(1, Number(options?.questionPage ?? 1)) : 1;
      const qSkip  = qHasPagination ? (qPage - 1) * qPageSize : 0;
      const qLimit = qPageSize;

    const pipeline: any[] = [
      { $match: { roomCode } },
       {
                $project: {
                  polls: 1,
                  totalStudents: { $size: '$joinedStudents' }
                }
              },

              { $unwind: '$polls' },

              {
                $addFields: {
                  responses: { $size: '$polls.answers' },
                  correctAnswers: {
                    $size: {
                      $filter: {
                        input: '$polls.answers',
                        as: 'a',
                        cond: { $eq: ['$$a.answerIndex', '$polls.correctOptionIndex'] }
                      }
                    }
                  },
                  totalTime: {
                    $sum: {
                      $map: {
                        input: '$polls.answers',
                        as: 'a',
                        in: { $subtract: ['$$a.answeredAt', '$polls.createdAt'] }
                      }
                    }
                  },
                  totalPoints: { $sum: '$polls.answers.points' }
                }
              },

              {
                $addFields: {
                  correctPct:    { $cond: [{ $gt: ['$responses', 0] }, { $multiply: [{ $divide: ['$correctAnswers', '$responses'] }, 100] }, 0] },
                  avgTimeSec:    { $cond: [{ $gt: ['$responses', 0] }, { $divide: ['$totalTime', { $multiply: ['$responses', 1000] }] }, 0] },
                  avgPoints:     { $cond: [{ $gt: ['$responses', 0] }, { $divide: ['$totalPoints', '$responses'] }, 0] },
                  engagementPct: { $cond: [{ $gt: ['$totalStudents', 0] }, { $multiply: [{ $divide: ['$responses', '$totalStudents'] }, 100] }, 0] }
                }
              },

              {
                $addFields: {
                  difficulty: {
                    $switch: {
                      branches: [
                        { case: { $gte: ['$correctPct', 80] }, then: 'Easy' },
                        { case: { $gte: ['$correctPct', 50] }, then: 'Medium' }
                      ],
                      default: 'Hard'
                    }
                  },
                  engagement: {
                    $switch: {
                      branches: [
                        { case: { $gte: ['$engagementPct', 80] }, then: 'High' },
                        { case: { $gte: ['$engagementPct', 50] }, then: 'Medium' }
                      ],
                      default: 'Low'
                    }
                  }
                }
              },

              {
                $project: {
                  _id: 0,
                  text: '$polls.question',
                  responses: 1,
                  correctPct:    { $round: ['$correctPct', 2] },
                  avgTime:       { $concat: [{ $toString: { $round: ['$avgTimeSec', 2] } }, 's'] },
                  avgPoints:     { $round: ['$avgPoints', 2] },
                  engagementPct: { $round: ['$engagementPct', 2] },
                  difficulty: 1,
                  engagement: 1
                }
              },

              // ─────────────────────────────────────────────────────────
              // PAGINATION via $group + $slice
              // ─────────────────────────────────────────────────────────
              {
                $group: {
                  _id: null,
                  items: { $push: '$$ROOT' },
                  total: { $sum: 1 }
                }
              },
              {
                $addFields: {
                  items: qHasPagination
                    ? { $slice: ['$items', qSkip, qLimit] }
                    : '$items',
                  pagination: {
                    totalItems:  '$total',
                    pageSize:    qHasPagination ? qPageSize : '$total',
                    currentPage: qHasPagination ? qPage     : 1,
                    totalPages: {
                      $cond: [
                        { $gt: ['$total', 0] },
                        qHasPagination
                          ? { $ceil: { $divide: ['$total', qPageSize] } }
                          : 1,
                        0
                      ]
                    }
                  }
                }
              },
              { $project: { _id: 0, items: 1, pagination: 1 } }
    ]
    const roomQuestions = await Room.aggregate(pipeline);
    if (!roomQuestions.length) throw new Error('Room not found');

    const finalResult  = roomQuestions[0]  ?? { items: [], pagination: { totalItems: 0, pageSize: 0, currentPage: 1, totalPages: 0 } };
    
    // console.log('questions:',finalResult)
    return finalResult;
  }
  //room students analysis
  async getRoomAnalysisStudents(
    roomCode: string,
     options?: {
      studentSortBy?: string;
      studentSortOrder?: string;
      studentSearch?: string;
      studentAccuracyBand?: string;
      studentParticipation?: string;
      studentPage?: number;
      studentPageSize?: number;
    }
  ) {

     //   Pipeline field names: points, accuracyPct, avgTimeSeconds
      const sortFieldMap: Record<string, string> = {
        accuracy: 'accuracyPct',
        avgTime: 'avgTimeSeconds',
        points: 'points',
      };

      const sortField = sortFieldMap[options?.studentSortBy ?? ''] ?? 'points';
      const sortDir = options?.studentSortOrder === 'asc' ? 1 : -1;

    // Students pagination
      const sPageSize = Number(options?.studentPageSize ?? 0);
      const sHasPagination = sPageSize > 0;
      const sPage  = sHasPagination ? Math.max(1, Number(options?.studentPage ?? 1)) : 1;
      const sSkip  = sHasPagination ? (sPage - 1) * sPageSize : 0;
      const sLimit = sPageSize;

    const pipeline: any[] = [
      { $match: { roomCode } },
      // 1. Flatten one document per student
      { $addFields: { totalQuestions: { $size: "$polls" } } },
              { $unwind: '$joinedStudents' },

              { $project: { studentId: '$joinedStudents', polls: 1 } },

              // 2. Compute per-student stats across all polls
              {
                $addFields: {
                  stats: {
                    $reduce: {
                      input: '$polls',
                      initialValue: {
                        attempted: 0, unAttempted: 0, missed: 0,
                        correct: 0, incorrect: 0, points: 0,
                        totalTime: 0, answerCount: 0
                      },
                      in: {
                        $let: {
                          vars: {
                            ans: {
                              $first: {
                                $filter: {
                                  input: '$$this.answers',
                                  as: 'a',
                                  cond: { $eq: ['$$a.userId', '$studentId'] }
                                }
                              }
                            },
                            isAnswered: {
                              $gt: [
                                { $size: { $filter: { input: '$$this.answers', as: 'a', cond: { $eq: ['$$a.userId', '$studentId'] } } } },
                                0
                              ]
                            },
                            isLocked: { $in: ['$studentId', '$$this.lockedActiveUsers'] }
                          },
                          in: {
                            attempted:   { $add: ['$$value.attempted',   { $cond: ['$$isAnswered', 1, 0] }] },
                            correct:     { $add: ['$$value.correct',     { $cond: [{ $and: ['$$isAnswered', { $eq: ['$$ans.answerIndex', '$$this.correctOptionIndex'] }] }, 1, 0] }] },
                            incorrect:   { $add: ['$$value.incorrect',   { $cond: [{ $and: ['$$isAnswered', { $ne: ['$$ans.answerIndex', '$$this.correctOptionIndex'] }] }, 1, 0] }] },
                            unAttempted: { $add: ['$$value.unAttempted', { $cond: [{ $and: [{ $not: ['$$isAnswered'] }, '$$isLocked'] }, 1, 0] }] },
                            missed:      { $add: ['$$value.missed',      { $cond: [{ $and: [{ $not: ['$$isAnswered'] }, { $not: ['$$isLocked'] }] }, 1, 0] }] },
                            points:      { $add: ['$$value.points',      { $ifNull: ['$$ans.points', 0] }] },
                            totalTime:   { $add: ['$$value.totalTime',   { $cond: ['$$isAnswered', { $subtract: ['$$ans.answeredAt', '$$this.createdAt'] }, 0] }] },
                            answerCount: { $add: ['$$value.answerCount', { $cond: ['$$isAnswered', 1, 0] }] }
                          }
                        }
                      }
                    }
                  }
                }
              },

              // 3. Join user document for name
              { $lookup: { from: 'users', localField: 'studentId', foreignField: 'firebaseUID', as: 'user' } },

              // 4. Compute derived fields (name, accuracy, avgTime, …)
              {
                $addFields: {
                  name: {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, ''] },
                          ' ',
                          { $ifNull: [{ $arrayElemAt: ['$user.lastName', 0] }, ''] }
                        ]
                      }
                    }
                  },
                                   avgTime: {
                    $cond: [
                      { $gt: ['$stats.answerCount', 0] },
                      { $concat: [{ $toString: { $round: [{ $divide: ['$stats.totalTime', { $multiply: ['$stats.answerCount', 1000] }] }, 2] } }, 's'] },
                      '0s'
                    ]
                  },

                  avgTimeSeconds: {
                    $round: [
                      { $cond: [{ $gt: ['$stats.answerCount', 0] }, { $divide: ['$stats.totalTime', { $multiply: ['$stats.answerCount', 1000] }] }, 0] },
                      2
                    ]
                  },

                  accuracyPct: {
                    $round: [
                      { $cond: [{ $gt: ['$stats.attempted', 0] }, { $multiply: [{ $divide: ['$stats.correct', '$stats.attempted'] }, 100] }, 0] },
                      2
                    ]
                  }
                }
              },

              {
                $project: {
                  _id: 0, studentId: 1, name: 1,
                  attempted:   '$stats.attempted',
                  unAttempted: '$stats.unAttempted',
                  missed:      '$stats.missed',
                  correct:     '$stats.correct',
                  incorrect:   '$stats.incorrect',
                  points:      '$stats.points',
                  accuracyPct: 1,
                  avgTimeSeconds: 1,
                  totalPollsCount: 1,
                  avgTime: 1,
                  totalTime:   { $round: [{ $divide: ['$stats.totalTime', 1000] }, 2] },
                }
              },

              // ─────────────────────────────────────────────────────────
              // RANKING via $setWindowFields  
              // ─────────────────────────────────────────────────────────
              {
                $setWindowFields: {
                  sortBy: { points: -1 },   // $denseRank requires exactly one sortBy field
                  output: {
                    rank: { $denseRank: {} }
                  }
                }
              },

              // ─────────────────────────────────────────────────────────
              // SEARCH via $match with $regex
              // ─────────────────────────────────────────────────────────
              ...(options?.studentSearch?.trim()
                ? [{ $match: { name: { $regex: options.studentSearch.trim(), $options: 'i' } } }]
                : []),

              // ─────────────────────────────────────────────────────────
              // FILTER by accuracy band
              // ─────────────────────────────────────────────────────────
              ...(() => {
                const band = options?.studentAccuracyBand;
                if (!band || band === 'all') return [];
                if (band === 'high')   return [{ $match: { accuracyPct: { $gte: 70 } } }];
                if (band === 'medium') return [{ $match: { accuracyPct: { $gte: 40, $lt: 70 } } }];
                if (band === 'low')    return [{ $match: { accuracyPct: { $lt: 40 } } }];
                return [];
              })(),

              // ─────────────────────────────────────────────────────────
              // FILTER by participation level
              // ─────────────────────────────────────────────────────────
              ...(() => {
      const p = options?.studentParticipation;
      if (!p || p === 'all') return [];
      if (p === 'complete')    return [{ $match: { $expr: { $and: [{ $gt: ['$totalPollsCount', 0] }, { $eq: ['$attempted', '$totalPollsCount'] }] } } }];
      if (p === 'partial')     return [{ $match: { $expr: { $and: [{ $gt: ['$attempted', 0] }, { $lt: ['$attempted', '$totalPollsCount'] }] } } }];
      if (p === 'no_attempts') return [{ $match: { attempted: 0 } }];
      return [];
    })()  ,

              // ─────────────────────────────────────────────────────────
              // SORTING via $sort
              // ─────────────────────────────────────────────────────────
              { $sort: { [sortField]: sortDir, points: -1,avgTimeSeconds: 1, totalTime: 1 } },

              // 11. Final Pagination via $facet
    {
      $facet: {
        metadata: [{ $count: 'totalItems' }],
        items: sHasPagination 
          ? [{ $skip: sSkip }, { $limit: sPageSize }] 
          : [] // If no pagination, we'll handle it in the next stage
      }
    },
              // 12. Format Final Output
    {
      $project: {
        items: { $ifNull: ['$items', []] },
        pagination: {
          totalItems: { $ifNull: [{ $arrayElemAt: ['$metadata.totalItems', 0] }, 0] },
          pageSize: { $literal: sHasPagination ? sPageSize : null },
          currentPage: { $literal: sPage }
        }
      }
    },
    {
      $addFields: {
        "pagination.totalPages": {
          $cond: [
            { $eq: ['$pagination.totalItems', 0] },
            0,
            { $ceil: { $divide: ['$pagination.totalItems', { $ifNull: ['$pagination.pageSize', '$pagination.totalItems'] }] } }
          ]
        }
      }
    }
    ]
    const roomStudents = await Room.aggregate(pipeline);
    if (!roomStudents.length) throw new Error('Room not found');

    const finalResult  = roomStudents[0]  ?? { items: [], pagination: { totalItems: 0, pageSize: 0, currentPage: 1, totalPages: 0 } };
    
    // console.log('students:',finalResult)
    return finalResult;
  }
  //room achievement analysis
  async getRoomAnalysisAchievements(roomCode: string) {

    const pipeline: any[] = [
       { $match: { roomCode } },
        {
          $facet: {
            badges: [
              { $group: { _id: '$badgeId', earned: { $sum: 1 } } },
              { $lookup: { from: 'badges', localField: '_id', foreignField: '_id', as: 'badge' } },
              { $unwind: '$badge' },
              { $project: { _id: 0, name: '$badge.name', description: '$badge.description', earned: 1 } }
            ],
            students: [
              { $group: { _id: '$userId', badgeIds: { $push: '$badgeId' } } },
              { $lookup: { from: 'badges', localField: 'badgeIds', foreignField: '_id', as: 'badgeDetails' } },
              { $lookup: { from: 'users',  localField: '_id',      foreignField: 'firebaseUID', as: 'user' } },
              {
                $addFields: {
                  name: {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, ''] },
                          ' ',
                          { $ifNull: [{ $arrayElemAt: ['$user.lastName', 0] }, ''] }
                        ]
                      }
                    }
                  }
                }
              },
              { $project: { _id: 0, name: 1, earnedBadges: '$badgeDetails.name' } }
            ]
          }
        }
    ]
    const roomAchievements = await UserAchievements.aggregate(pipeline);
    if (!roomAchievements.length) throw new Error('Room not found');
    // console.log('achievement:',roomAchievements)
    return roomAchievements[0];
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
      controls: roomDoc.controls || { micBlocked: false, pollRestricted: false },
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
    this.triggerLiveOverviewUpdate(roomCode);
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
    this.triggerLiveOverviewUpdate(roomCode);
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

    this.triggerLiveOverviewUpdate(decoded.roomId);

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
    await Room.updateOne(
      { roomCode, "coHosts.userId": userId },
      { $set: { "coHosts.$.isActive": false } }
    );
    // Get updated cohost list
    const activeCohosts = await this.getRoomCohosts(teacherId, roomCode);
    pollSocket?.emitToRoom(roomCode, 'cohost-removed', {
      removedUserId: userId,
      activeCohosts: activeCohosts
    });
    
    this.triggerLiveOverviewUpdate(roomCode);

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
}
