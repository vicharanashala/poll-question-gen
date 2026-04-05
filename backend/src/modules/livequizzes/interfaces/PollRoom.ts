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
  scheduledAt?: Date;
  isLaunched?: boolean;
  launchedAt?: Date;
  lockedActiveUsers?: string[];
  createdAt: Date;
  answers: PollAnswer[];
  // PHASE 2: Question Approval Workflow
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  approvedBy?: string;
  approvedByType?: ModerationActorType;
  approvedByCohostType?: CohostType;
  approvedByName?: string;
  requestedBy?: string;
  rejectedBy?: string;
  rejectedByType?: ModerationActorType;
  rejectedByCohostType?: CohostType;
  rejectedByName?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  approvedAt?: Date;
}

export type CohostType = 'teacher' | 'guest';
export type ModerationActorType = 'host' | 'cohost';

export interface RoomStudent {
  id: string;
  firebaseUID?: string;
  firstName?: string;
  email?: string;
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
  students?: RoomStudent[];
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
  type?: 'teacher-cohost';
}

export interface GuestCohostJwtPayload extends JwtPayload {
  roomId: string;
  jti: string;
  type: 'guest-cohost';
}

export interface GetCohostRoom {
  rooms: Room[];
  count: number;
}

export interface ActiveCohost {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  displayName?: string;
  type?: CohostType;
  addedAt: Date;
  isMicMuted?: boolean;
}

