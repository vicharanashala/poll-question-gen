import mongoose from 'mongoose';

const ConfusionLogSchema = new mongoose.Schema({
  roomCode: { type: String, required: true },
  studentId: { type: String, required: true },
  clicks: { type: Number, default: 0 },
});

export const ConfusionLog = mongoose.model('ConfusionLog', ConfusionLogSchema);
