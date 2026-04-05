import { Server } from 'socket.io';
import { RoomService } from '../services/RoomService.js';  // adjust the path as needed
import dotenv from 'dotenv';
import { NotFoundError } from 'routing-controllers';
import { UserRepository } from '#root/shared/index.js';
import { Room } from '#root/shared/database/models/Room.js';
import { appConfig } from '../../../config/app.js';
import { DashboardService } from '../services/DashboardService.js';

dotenv.config();
const appOrigins = appConfig.origins;

class PollSocket {
  private io: Server | null = null;
  // For tracking active connections by socket ID and room code
  private activeConnections: Map<string, string[]> = new Map();
  private activeUsersPerRoom: Map<string, Set<string>> = new Map(); // roomCode -> Set<firebaseUID>


  constructor(private readonly roomService: RoomService,
    private readonly userRepo: UserRepository,
    private readonly dashboardService: DashboardService
    // private readonly userService:UserService
  ) { }

  private getStudentDashboardRoom(studentId: string): string {
    return `student-dashboard:${studentId}`;
  }

  init(server: import('http').Server) {
    this.io = new Server(server, {
      cors: { origin: appOrigins || 'http://localhost:3000' },
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    this.io.on('connection', socket => {
      console.log('Client connected', socket.id);

      socket.on('subscribe-student-dashboard', async (studentId: string) => {
        if (typeof studentId !== 'string' || !studentId.trim()) {
          socket.emit('error', 'Invalid student dashboard subscription payload');
          return;
        }

        socket.data.userId = socket.data.userId || studentId;
        socket.data.dashboardStudentId = studentId;
        socket.join(this.getStudentDashboardRoom(studentId));
        await this.emitStudentDashboardUpdate(studentId);
      });

      socket.on('unsubscribe-student-dashboard', (studentId?: string) => {
        const targetStudentId =
          (typeof studentId === 'string' && studentId.trim()) ||
          (typeof socket.data.dashboardStudentId === 'string' ? socket.data.dashboardStudentId : '');

        if (!targetStudentId) {
          return;
        }

        socket.leave(this.getStudentDashboardRoom(targetStudentId));
        if (socket.data.dashboardStudentId === targetStudentId) {
          delete socket.data.dashboardStudentId;
        }
      });

      socket.on('join-room', async (roomCode: string, email: string) => {
        try {
          const isActive = await this.roomService.isRoomValid(roomCode);
          if (typeof email === 'string' && email.trim() !== '') {
            const user = await this.userRepo.findByEmail(email)
            console.log('user:', user)
            const userId = user?._id;
            socket.data.userId = user?.firebaseUID;
            await this.roomService.enrollStudent(userId as string, roomCode, user?.firebaseUID as string)
          }
          if (isActive) {
            socket.join(roomCode);
            socket.data.email = email
            if (!this.activeConnections.has(socket.id)) {
              this.activeConnections.set(socket.id, []);
            }
            this.activeConnections.get(socket.id)?.push(roomCode);
            if (socket.data.userId) {
              if (!this.activeUsersPerRoom.has(roomCode)) {
                this.activeUsersPerRoom.set(roomCode, new Set());
              }
              this.activeUsersPerRoom.get(roomCode)!.add(socket.data.userId);
            }
            await this.emitRoomUpdated(roomCode);
            if (socket.data.userId) {
              await this.emitStudentDashboardUpdate(socket.data.userId);
            }
            console.log(`Socket ${socket.id} joined active room: ${roomCode}`);
            console.log(`Active connections: ${this.activeConnections.size}`);
          } else {
            console.log(`Join failed: room ended or invalid: ${roomCode}`);
            socket.emit('room-ended');  // immediately tell the client
          }
        } catch (err) {
          console.error('Error checking room status:', err);
          socket.emit('error', 'Unexpected server error');
        }
      });

      socket.on('leave-room', async (roomCode: string, email: string) => {
        let leavingStudentId: string | undefined;
        if (email) {
          const user = await this.userRepo.findByEmail(email)
          leavingStudentId = user?.firebaseUID;
          const userId = user._id as string
          await this.roomService.unEnrollStudent(userId, roomCode)
        }
        socket.leave(roomCode);
        if (socket.data.userId) {
          this.activeUsersPerRoom.get(roomCode)?.delete(socket.data.userId);
        }
        await this.emitRoomUpdated(roomCode);
        const rooms = this.activeConnections.get(socket.id) || [];
        const updatedRooms = rooms.filter(r => r !== roomCode);
        if (updatedRooms.length > 0) {
          this.activeConnections.set(socket.id, updatedRooms);
        } else {
          this.activeConnections.delete(socket.id);
        }

        if (leavingStudentId) {
          await this.emitStudentDashboardUpdate(leavingStudentId);
        }

        console.log(`Socket ${socket.id} left room: ${roomCode}`);
      });

      socket.on("remove-student", async ({ roomCode, email, actorId }) => {

        try {
          if (!roomCode || !email || !actorId) {
            socket.emit('error', 'Missing remove-student payload');
            return;
          }

          const isAuthorized = await this.roomService.isUserTeacherOrCohost(actorId, roomCode);
          if (!isAuthorized) {
            socket.emit('error', 'Only host or cohost can remove students');
            return;
          }

          const user = await this.userRepo.findByEmail(email);

          if (!user) return;

          const userId = user._id.toString();
          const removedStudentId = user.firebaseUID;

          await this.roomService.unEnrollStudent(userId, roomCode);

          let studentSocketId: string | null = null;

          for (const [socketId, rooms] of this.activeConnections.entries()) {

            if (rooms.includes(roomCode)) {

              const s = this.io.sockets.sockets.get(socketId);

              if (s?.data?.email === email) {
                studentSocketId = socketId;
                break;
              }

            }

          }

          if (studentSocketId) {

            const studentSocket = this.io.sockets.sockets.get(studentSocketId);

            studentSocket.leave(roomCode);

            studentSocket.emit("removed-from-room", roomCode);

            this.activeConnections.delete(studentSocketId);

            const removedFirebaseUID = studentSocket?.data?.userId;
            if (removedFirebaseUID) {
              this.activeUsersPerRoom.get(roomCode)?.delete(removedFirebaseUID);
            }

          }
          await this.emitRoomUpdated(roomCode);
          if (removedStudentId) {
            await this.emitStudentDashboardUpdate(removedStudentId);
          }

        }
        catch (err) {
          console.error("remove student error", err);
        }

      });

      socket.on('update-room-control', async ({ roomCode, mode, actorId }) => {
        try {
          if (!roomCode || !actorId) {
            socket.emit('error', 'Missing room control payload');
            return;
          }

          const room = await Room.findOne({ roomCode }).lean();
          if (!room || room.teacherId !== actorId) {
            socket.emit('error', 'Only host can update room controls');
            return;
          }

          console.log(`Room ${roomCode} control updated to: ${mode} by socket ${socket.id}`);

          socket.to(roomCode).emit('room-control-updated', { mode });
        } catch (err) {
          console.error("update-room-control error", err);
        }
      });

      socket.on('cohost-leave', async (roomCode: string, cohostId: string) => {
        const room = await Room.findOne({ roomCode });
        if (!room) {
          throw new NotFoundError("Room is not found")
        }
        const teacherId = room.teacherId
        room.coHosts.forEach(c => {
          if (c.userId?.toString() === cohostId) {
            c.isActive = false;
          }
        });
        await room.save();
        // Get updated cohost list
        const activeCohosts = await this.roomService.getRoomCohosts(teacherId, roomCode);
        this.emitToRoom(roomCode, 'cohost-left', {
          removedUserId: cohostId,
          activeCohosts: activeCohosts
        });
      })

      socket.on('disconnect', async () => {
        const rooms = this.activeConnections.get(socket.id) || [];
        const firebaseUID = socket.data.userId;
        for (const roomCode of rooms) {
          if (firebaseUID) {
            this.activeUsersPerRoom.get(roomCode)?.delete(firebaseUID);
          }
        }
        this.activeConnections.delete(socket.id);
        for (const roomCode of rooms) {
          await this.emitRoomUpdated(roomCode);
        }
        console.log(`Socket ${socket.id} disconnected. Active connections: ${this.activeConnections.size}`);
      });
    });
  }

  private async emitRoomUpdated(roomCode: string) {
    const room = await this.roomService.getRoomByCode(roomCode);
    if (!room) {
      return;
    }

    const activeUsers = new Set(this.getActiveUsersInRoom(roomCode));
    const roomStudents = Array.isArray(room.students) ? room.students : [];

    const activeStudents = roomStudents.filter((student) => {
      const ids = [student?.firebaseUID, student?.id].filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      );
      return ids.some(id => activeUsers.has(id));
    });

    room.students = activeStudents;
    room.totalStudents = activeStudents.length;

    this.emitToRoom(roomCode, 'room-updated', room);
  }

  async emitStudentDashboardUpdate(studentId: string) {
    if (!this.io || !studentId) {
      return;
    }

    try {
      const [dashboardData, achievementProgress] = await Promise.all([
        this.dashboardService.getStudentDashboardData(studentId),
        this.dashboardService.getUserAchievementProgress(studentId)
      ]);

      this.io.to(this.getStudentDashboardRoom(studentId)).emit('student-dashboard-updated', {
        studentId,
        dashboardData,
        achievementProgress,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Failed to emit dashboard update for student ${studentId}:`, error);
    }
  }

  async emitRoomDashboardUpdates(roomCode: string) {
    const room = await Room.findOne({ roomCode }, 'joinedStudents').lean();
    if (!room || !Array.isArray(room.joinedStudents) || room.joinedStudents.length === 0) {
      return;
    }

    const uniqueStudents = [...new Set(room.joinedStudents)];
    await Promise.all(uniqueStudents.map((studentId) => this.emitStudentDashboardUpdate(studentId)));
  }

  getActiveUsersInRoom(roomCode: string): string[] {
    return Array.from(this.activeUsersPerRoom.get(roomCode) ?? []);
  }

  emitToRoom(roomCode: string, event: string, data: any) {
    if (this.io) {
      this.io.to(roomCode).emit(event, data);
    } else {
      console.warn('Socket.IO not initialized');
    }
  }

  emitToAll(roomCode: string, event: string, data: any) {
    if (!this.io) {
      console.error('Socket.IO not initialized');
      return;
    }
    this.io.emit(event, data);
  }

  // PHASE 2 & 3: Emit to specific user/socket
  emitToSocket(userId: string, event: string, data: any) {
    if (!this.io) {
      console.error('Socket.IO not initialized');
      return;
    }
    // Find socket IDs for this userId and emit to them
    this.io.sockets.sockets.forEach((socket) => {
      if (socket.data.userId === userId) {
        socket.emit(event, data);
      }
    });
  }
}
export const pollSocket = new PollSocket(
  new RoomService(),
  new UserRepository(),
  new DashboardService()
);