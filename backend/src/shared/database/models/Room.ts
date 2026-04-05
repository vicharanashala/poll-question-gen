import mongoose from 'mongoose';

const AnswerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  answerIndex: { type: Number, required: true },
  answeredAt: { type: Date, default: Date.now },
  points: { type: Number, default: 0 }
});

const PollSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  question: { type: String, required: true },
  options: [{ type: String }],
  correctOptionIndex: { type: Number, default: -1 },
  timer: { type: Number, default: 30 },
  lockedActiveUsers: [{ type: String }],
  maxPoints: { type: Number, default: 20 },
  scheduledAt: { type: Date },
  isLaunched: { type: Boolean, default: true },
  launchedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  answers: [AnswerSchema],
  // PHASE 2: Question Approval Workflow
  approvalStatus: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved' },
  approvedBy: { type: String },
  approvedByType: { type: String, enum: ['host', 'cohost'] },
  approvedByCohostType: { type: String, enum: ['teacher', 'guest'] },
  approvedByName: { type: String },
  requestedBy: { type: String },
  rejectedBy: { type: String },
  rejectedByType: { type: String, enum: ['host', 'cohost'] },
  rejectedByCohostType: { type: String, enum: ['teacher', 'guest'] },
  rejectedByName: { type: String },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  approvedAt: { type: Date }
});

const CoHostSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    addedBy: { type: String, required: true },
    type: {
      type: String,
      enum: ['teacher', 'guest'],
      default: 'teacher'
    },
    displayName: {
      type: String,
      default: null
    },
    email: {
      type: String,
      default: null
    },
    sessionId: {
      type: String,
      default: null
    },
    addedAt: {
      type: Date,
      default: Date.now
    },

    isActive: {
      type: Boolean,
      default: true
    },
    
    isMicMuted: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const CoHostInviteSchema = new mongoose.Schema(
  {
    inviteId: {
      type: String   // JWT jti
    },

    expiresAt: {
      type: Date
    },

    isActive: {
      type: Boolean,
      default: false
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const GuestCoHostInviteSchema = new mongoose.Schema(
  {
    inviteId: {
      type: String   // JWT jti
    },

    expiresAt: {
      type: Date
    },

    isActive: {
      type: Boolean,
      default: false
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const RecordingLockSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String },
    lockedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date }
  },
  {_id: false}
);

// PHASE 3: Student Management & Moderation
const MutedStudentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true },
    mutedBy: { type: String, required: true },
    mutedByType: { type: String, enum: ['host', 'cohost'] },
    mutedByName: { type: String },
    mutedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const RoomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  teacherId: { type: String, required: true },
  teacherName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  polls: [PollSchema],
  joinedStudents: [{ type: String }],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  recordingLock: RecordingLockSchema,
  coHosts: [CoHostSchema],
  coHostInvite: CoHostInviteSchema,
  guestCoHostInvite: GuestCoHostInviteSchema,
  controls: {
    micBlocked: { type: Boolean, default: false },
    pollRestricted: { type: Boolean, default: false }
  },
  // PHASE 2: Question Approval Workflow
  questionApprovalRequired: { type: Boolean, default: false },
  // PHASE 3: Student Management & Moderation
  mutedStudents: [MutedStudentSchema]
});

RoomSchema.index({ teacherId: 1 });
export const Room = mongoose.model('Room', RoomSchema);
