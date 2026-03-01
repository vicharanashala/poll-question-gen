export interface PollAnswer {
  userId: string;
  answerIndex: number;
  answeredAt: Date;
  responseTime?: number; // Time taken to answer in milliseconds
  pointsEarned?: number; // Points earned for this answer
}

export interface Poll {
  _id: string; // uuid string
  question: string;
  options: string[];
  correctOptionIndex: number;
  timer: number;
  maxPoints?: number; // Maximum points for correct answer
  createdAt: Date;
  releasedAt?: Date; // When the poll was released to students
  answers: PollAnswer[];
}

export interface Room {
  roomCode: string;
  name: string;
  teacherId: string;
  teacherName?: string;
  createdAt: Date;
  status: 'active' | 'ended';
  polls: Poll[];
}
