import mongoose from 'mongoose';

const AnswerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  answerIndex: { type: Number, required: true },
  answeredAt: { type: Date, default: Date.now }
});

const PollSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  question: { type: String, required: true },
  options: [{ type: String }],
  correctOptionIndex: { type: Number, default: -1 },
  timer: { type: Number, default: 30 },
  createdAt: { type: Date, default: Date.now },
  source: { type: String, enum: ['manual', 'auto'], default: 'manual' }, // Question source
  createdBy: { type: String }, // User ID who created the question
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
  questionMode: { type: String, enum: ['manual', 'auto', 'paused'], default: 'manual' }, // Question generation mode
  polls: [PollSchema],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

RoomSchema.index({ teacherId: 1 });
export const Room = mongoose.model('Room', RoomSchema);
