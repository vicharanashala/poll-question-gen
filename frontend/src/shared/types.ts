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

// =========================
// 📊 OVERVIEW
// =========================
export type Overview = {
  roomCode: string;
  name: string;
  createdAt: string; // or Date if parsed
  status: string;

  totalStudents: number;
  totalCohosts: number;
  questionsAsked: number;

  pointsDistributed: number;
  earnedPoints: number;

  avgAccuracy: number; // ✅ added
};

// =========================
// 👨‍🎓 STUDENT STATS
// =========================
export type StudentStats = {
  studentId: string;
  name: string; // ✅ now always present

  attempted: number;
  unAttempted: number; // ✅ added
  missed: number; // ✅ added

  correct: number;
  incorrect: number;
  points: number;

  totalTime: number; // ✅ added (seconds)
  avgTime: string;
  rank: number; // ✅ added
};

// =========================
// ❓ QUESTION STATS
// =========================
export type QuestionStats = {
  text: string;
  responses: number;

  correctPct: number;
  avgTime: string; // ✅ added
  avgPoints: number; // ✅ added
  engagementPct: number; // ✅ added

  difficulty: "Easy" | "Medium" | "Hard"; // ✅ added
  engagement: "High" | "Medium" | "Low"; // ✅ added
};

// =========================
// 🏆 BADGE SUMMARY
// =========================
export type BadgeSummary = {
  name: string;
  earned: number;
  description: string;
};

// =========================
// 🎖 STUDENT ACHIEVEMENTS
// =========================
export type StudentAchievement = {
  name: string;
  earnedBadges: string[];
};

// =========================
// 🧩 ACHIEVEMENTS
// =========================
export type Achievements = {
  badges: BadgeSummary[];
  students: StudentAchievement[];
};

// =========================
// 📦 DASHBOARD DATA
// =========================
export type DashboardData = {
  overview: Overview;
  students: StudentStats[];
  questions: QuestionStats[];
  achievements: Achievements;
};

// =========================
// 🌐 API RESPONSE
// =========================
export type DashboardResponse = {
  dashboardData: DashboardData;
};

export type LineChartPoint = {
  label: string;
  value: number;
};

export type StudentSortBy = 'points' | 'avgTime' | 'accuracy';
export type StudentSortOrder = 'asc' | 'desc';
