import { Server } from 'socket.io';
import { RoomService } from '../services/RoomService.js';  // adjust the path as needed
import dotenv from 'dotenv';
import { UserService } from '#root/modules/users/services/UserService.js';
import { getFromContainer } from 'routing-controllers';
import { UserRepository } from '#root/shared/index.js';

dotenv.config();
const appOrigins = process.env.APP_ORIGINS;

class PollSocket {
  private io: Server | null = null;
  // For tracking active connections by socket ID and room code
  private activeConnections: Map<string, string[]> = new Map();

  constructor(private readonly roomService: RoomService,
    private readonly userRepo: UserRepository
    // private readonly userService:UserService
  ) { }

  init(server: import('http').Server) {
    this.io = new Server(server, {
      cors: { origin: appOrigins || 'http://localhost:3000' },
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    this.io.on('connection', socket => {
      console.log('Client connected', socket.id);

      socket.on('join-room', async (roomCode: string, email: string) => {
        try {
          const isActive = await this.roomService.isRoomValid(roomCode);
          if (email) {
            const user = await this.userRepo.findByEmail(email)
            const userId = user?._id;
            await this.roomService.enrollStudent(userId as string, roomCode)
          }
          if (isActive) {
            socket.join(roomCode);
            if (!this.activeConnections.has(socket.id)) {
              this.activeConnections.set(socket.id, []);
            }
            this.activeConnections.get(socket.id)?.push(roomCode);
            const room = await this.roomService.getRoomByCode(roomCode)
            // socket.emit('room-data',room)
            this.emitToRoom(roomCode, 'room-updated', room)
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
        if (email) {
          const user = await this.userRepo.findByEmail(email)
          const userId = user._id as string
          await this.roomService.unEnrollStudent(userId, roomCode)
        }
        socket.leave(roomCode);
        const room = await this.roomService.getRoomByCode(roomCode)
        this.emitToRoom(roomCode, 'room-updated', room)
        const rooms = this.activeConnections.get(socket.id) || [];
        const updatedRooms = rooms.filter(r => r !== roomCode);
        if (updatedRooms.length > 0) {
          this.activeConnections.set(socket.id, updatedRooms);
        } else {
          this.activeConnections.delete(socket.id);
        }

        console.log(`Socket ${socket.id} left room: ${roomCode}`);
      });

      socket.on('disconnect', () => {
        this.activeConnections.delete(socket.id);
        console.log(`Socket ${socket.id} disconnected. Active connections: ${this.activeConnections.size}`);
      });
    });
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
}
const userService = getFromContainer(UserService)
export const pollSocket = new PollSocket(new RoomService(), new UserRepository()
  // userService
);