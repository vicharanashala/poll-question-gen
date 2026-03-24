import { JwtPayload } from "jsonwebtoken";

export interface PollAnswer {
  userId: string;
  answerIndex: number;
  answeredAt: Date;
  points?: number;
}

export interface Poll {
  _id: string; // uuid string
  question: string;
  options: string[];
  correctOptionIndex: number;
  timer: number;
  maxPoints?: number;
  lockedActiveUsers?: string[];
  createdAt: Date;
  answers: PollAnswer[];
  // PHASE 2: Question Approval Workflow
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  approvedBy?: string;
  requestedBy?: string;
  rejectionReason?: string;
  approvedAt?: Date;
}

export interface Room {
  roomCode: string;
  name: string;
  teacherId: string;
  teacherName?: string;
  createdAt: Date;
  endedAt?: Date;
  status: 'active' | 'ended';
  polls: Poll[];
  totalStudents?: number;
  coHosts?: ActiveCohost[];
  controls?: {
    micBlocked: boolean;
    pollRestricted: boolean;
  };
  joinedStudents?: string[];
}

export interface CohostJwtPayload extends JwtPayload {
  roomId: string;
  jti: string;
}

export interface GetCohostRoom {
  rooms: Room[];
  count: number;
}

export interface ActiveCohost {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  addedAt: Date;
}

