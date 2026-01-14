import mongoose from 'mongoose';

const AnswerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  answerIndex: { type: Number, required: true },
  answeredAt: { type: Date, default: Date.now },
  responseTime: { type: Number }, // Time taken to answer in milliseconds
  pointsEarned: { type: Number, default: 0 } // Points earned for this answer
});

const PollSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  question: { type: String, required: true },
  options: [{ type: String }],
  correctOptionIndex: { type: Number, default: -1 },
  timer: { type: Number, default: 30 }, // Timer in seconds
  maxPoints: { type: Number, default: 100 }, // Maximum points for correct answer
  createdAt: { type: Date, default: Date.now },
  releasedAt: { type: Date }, // When the poll was released to students
  answers: [AnswerSchema]
});

const RoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  teacherId: { type: String, required: true },
  teacherName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date }, 
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  polls: [PollSchema],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

RoomSchema.index({ teacherId: 1 });
export const Room = mongoose.model('Room', RoomSchema);
