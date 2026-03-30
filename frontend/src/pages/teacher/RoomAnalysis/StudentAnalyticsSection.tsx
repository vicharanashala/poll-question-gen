import { ChevronDown, Filter, Search } from "lucide-react";
import { DashboardData } from "@/shared/types";
import { StudentSortBy, StudentSortOrder } from "@/shared/types";

type Props = {
  analysisData: DashboardData | null;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  accuracyFilter: "all" | "high" | "medium" | "low";
  setAccuracyFilter: (value: "all" | "high" | "medium" | "low") => void;
  participationFilter: "all" | "complete" | "partial" | "no_attempts";
  setParticipationFilter: (value: "all" | "complete" | "partial" | "no_attempts") => void;
  studentSortBy: StudentSortBy;
  studentSortOrder: StudentSortOrder;
  handleStudentSort: (key: StudentSortBy) => void;
  getStudentAccuracy: (student: DashboardData["students"][number]) => number;
};

export const StudentAnalyticsSection = ({
  analysisData,
  isLoading,
  searchQuery,
  setSearchQuery,
  accuracyFilter,
  setAccuracyFilter,
  participationFilter,
  setParticipationFilter,
  studentSortBy,
  studentSortOrder,
  handleStudentSort,
  getStudentAccuracy,
}: Props) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-auto sm:h-[600px] transition-colors">
    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white">Student Performance</h3>
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full sm:w-auto">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search students..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400 dark:text-slate-500" />
          <select
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200"
            value={accuracyFilter}
            onChange={(e) => setAccuracyFilter(e.target.value as "all" | "high" | "medium" | "low")}
          >
            <option value="all">All accuracy</option>
            <option value="high">High accuracy</option>
            <option value="medium">Medium accuracy</option>
            <option value="low">Low accuracy</option>
          </select>
          <select
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200"
            value={participationFilter}
            onChange={(e) => setParticipationFilter(e.target.value as "all" | "complete" | "partial" | "no_attempts")}
          >
            <option value="all">All participation</option>
            <option value="complete">Completed all</option>
            <option value="partial">Partial attempts</option>
            <option value="no_attempts">No attempts</option>
          </select>
        </div>
      </div>
    </div>
    <div className="overflow-x-auto flex-1">
      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[700px]">
        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 font-semibold sticky top-0 z-10 transition-colors">
          <tr>
            <th className="p-4">Student Name</th>
            <th className="p-4">Attempted</th>
            <th className="p-4">UnAttempted</th>
            <th className="p-4">Missed</th>
            <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleStudentSort("accuracy")}>
              <div className="flex items-center gap-1">Accuracy {studentSortBy === "accuracy" && <ChevronDown size={14} className={studentSortOrder === "asc" ? "rotate-180" : ""} />}</div>
            </th>
            <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleStudentSort("avgTime")}>
              <div className="flex items-center gap-1">Avg Time {studentSortBy === "avgTime" && <ChevronDown size={14} className={studentSortOrder === "asc" ? "rotate-180" : ""} />}</div>
            </th>
            <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleStudentSort("points")}>
              <div className="flex items-center gap-1">Total Points {studentSortBy === "points" && <ChevronDown size={14} className={studentSortOrder === "asc" ? "rotate-180" : ""} />}</div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {isLoading &&
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={`loading-${index}`} className="animate-pulse">
                <td className="p-4"><div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" /></td>
                <td className="p-4"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" /></td>
                <td className="p-4"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" /></td>
                <td className="p-4"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" /></td>
                <td className="p-4"><div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" /></td>
                <td className="p-4"><div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700" /></td>
                <td className="p-4"><div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" /></td>
              </tr>
            ))}
          {!isLoading && analysisData?.students?.map((student) => (
            <tr key={student.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="p-4 font-medium text-slate-800 dark:text-slate-100">{student.name}</td>
              <td className="p-4">{student.attempted} / {analysisData?.overview?.questionsAsked ?? 0}</td>
              <td className="p-4">{student.unAttempted} / {analysisData?.overview?.questionsAsked ?? 0}</td>
              <td className="p-4">{student.missed} / {analysisData?.overview?.questionsAsked ?? 0}</td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <span className="w-10">{getStudentAccuracy(student)}%</span>
                  <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStudentAccuracy(student) > 70 ? "bg-emerald-500" : getStudentAccuracy(student) > 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${getStudentAccuracy(student)}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  <span className="text-emerald-600 dark:text-emerald-400">{student.correct} ✓</span> | <span className="text-red-500 dark:text-red-400">{student.incorrect} ✗</span>
                </div>
              </td>
              <td className="p-4 text-slate-500 dark:text-slate-400">{student.avgTime}</td>
              <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{student.points.toLocaleString()}</td>
            </tr>
          ))}
          {!isLoading && analysisData?.students?.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">
                No students match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);
