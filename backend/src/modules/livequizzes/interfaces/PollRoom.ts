export interface PollAnswer {
  userId: string;
  answerIndex: number;
  answeredAt: Date;
}

export interface Poll {
  _id: string; // uuid string
  question: string;
  options: string[];
  correctOptionIndex: number;
  timer: number;
  createdAt: Date;
  source?: 'manual' | 'auto'; // Question source
  createdBy?: string; // User ID who created the question
  answers: PollAnswer[];
}

export interface Room {
  roomCode: string;
  name: string;
  teacherId: string;
  teacherName?: string;
  createdAt: Date;
  status: 'active' | 'ended';
  questionMode?: 'manual' | 'auto' | 'paused'; // Question generation mode
  polls: Poll[];
}
