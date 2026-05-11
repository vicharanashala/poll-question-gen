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

export type ModalType = "delete" | "edit" | "default";

export interface ModalState {
  title: string;
  description: string;
  type: ModalType;
  confirmText?: string;
  cancelText?: string;
}

export type Overview = {
  roomCode: string;
  name: string;
  createdAt: string;
  status: string;
  totalStudents: number;
  totalCohosts: number;
  questionsAsked: number;
  pointsDistributed: number;
  earnedPoints: number;
  avgAccuracy: number;
  endedAt?: string;
};

export type StudentStats = {
  studentId: string;
  name: string;
  attempted: number;
  unAttempted: number;
  missed: number;
  correct: number;
  incorrect: number;
  points: number;
  totalTime: number;
  avgTime: string;
  rank: number;
};

export type PaginationMeta = {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type QuestionStats = {
  text: string;
  responses: number;
  correctPct: number;
  avgTime: string;
  avgPoints: number;
  engagementPct: number;
  difficulty: "Easy" | "Medium" | "Hard";
  engagement: "High" | "Medium" | "Low";
};

export type BadgeSummary = {
  name: string;
  earned: number;
  description: string;
};

export type StudentAchievement = {
  name: string;
  earnedBadges: string[];
};

export type Achievements = {
  badges: BadgeSummary[];
  students: StudentAchievement[];
};

export type DashboardData = {
  overview: Overview;
  students: StudentStats[];
  questions: QuestionStats[];
  pagination: {
    students: PaginationMeta;
    questions: PaginationMeta;
  };
  achievements: Achievements;
};

export type DashboardResponse = {
  dashboardData: DashboardData;
};

export type LineChartPoint = {
  label: string;
  value: number;
  tooltip?: string;
};

export type StudentSortBy = "points" | "avgTime" | "accuracy";
export type StudentSortOrder = "asc" | "desc";
