export type CohostUser = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  addedAt: Date;
  isMicMuted?: boolean;
};

export interface Badge {
  _id: string;
  name: string;
  description: string;
  icon: string;
  category: "performance" | "engagement" | "speed" | "milestone";
  criteria: string;
}

export interface UserAchievement {
  _id: string;
  badgeId: Badge;
  earnedAt: string;
}

export type ModalType = 'delete' | 'edit' | 'default';

export interface ModalState {
  title: string;
  description: string;
  type: ModalType;
  confirmText?: string;
  cancelText?: string;
}

// PHASE 2 & 3: Question Approval and Student Moderation Types
export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface PendingQuestion {
  _id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  timer: number;
  maxPoints?: number;
  createdAt: Date;
  approvalStatus: ApprovalStatus;
  requestedBy?: string;
}

export interface MutedStudent {
  studentId: string;
  mutedBy: string;
  mutedAt: Date;
}

