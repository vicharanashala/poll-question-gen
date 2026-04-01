import { useDeferredValue, useEffect, useMemo, useState } from "react";
import socket from "@/lib/api/socket";
import { useParams } from "@tanstack/react-router";
import { Calendar, Clock, FileSpreadsheet, Hash } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import api from "@/lib/api/api";
import {
  DashboardData,
  LineChartPoint,
  PaginationMeta,
  QuestionStats,
  StudentSortBy,
  StudentSortOrder,
  StudentStats,
} from "@/shared/types";
import LiveTimer from "@/components/LiveTimer";
import { formatDate } from "@/utils/formatDate";
import { AchievementsTab } from "./RoomAnalysis/AchievementsTab";
import { DraggableMenu } from "./RoomAnalysis/DraggableMenu";
import { OverviewTab } from "./RoomAnalysis/OverviewTab";
import { QuestionsTab } from "./RoomAnalysis/QuestionsTab";
import { EmptyState, LoadingState } from "./RoomAnalysis/States";
import { StudentAnalyticsSection } from "./RoomAnalysis/StudentAnalyticsSection";
import { useAuthStore } from "@/lib/store/auth-store";

const STUDENT_PAGE_SIZE = 10;
const QUESTION_PAGE_SIZE = 5;

const emptyPagination = (pageSize: number): PaginationMeta => ({
  currentPage: 1,
  pageSize,
  totalItems: 0,
  totalPages: 0,
});

export default function TeacherPollAnalysis() {
  const { roomId } = useParams({ from: "/teacher/manage-rooms/pollanalysis/$roomId" });
  const { user: currentUser } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<DashboardData | null>(null);
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [questions, setQuestions] = useState<QuestionStats[]>([]);
  const [studentPagination, setStudentPagination] = useState<PaginationMeta>(emptyPagination(STUDENT_PAGE_SIZE));
  const [questionPagination, setQuestionPagination] = useState<PaginationMeta>(emptyPagination(QUESTION_PAGE_SIZE));
  const [studentSortBy, setStudentSortBy] = useState<StudentSortBy>("points");
  const [studentSortOrder, setStudentSortOrder] = useState<StudentSortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [accuracyFilter, setAccuracyFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [participationFilter, setParticipationFilter] = useState<"all" | "complete" | "partial" | "no_attempts">("all");
  const [studentPage, setStudentPage] = useState(1);
  const [questionPage, setQuestionPage] = useState(1);
  const [activeTab, setActiveTab] = useState("overview");

  const deferredSearchQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    setStudentPage(1);
  }, [studentSortBy, studentSortOrder, deferredSearchQuery, accuracyFilter, participationFilter]);

  useEffect(() => {
    setQuestionPage(1);
  }, [roomId]);

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get(`/livequizzes/rooms/${roomId}/analysis`);
        const result = response.data;

        if (!result.success) {
          throw new Error("Failed to get analysis data");
        }

        const dashboard = result.data.dashboard as DashboardData;
        setAnalysisData(dashboard);
        setStudents(dashboard.students);
        setQuestions(dashboard.questions);
        setStudentPagination(dashboard.pagination?.students ?? emptyPagination(STUDENT_PAGE_SIZE));
        setQuestionPagination(dashboard.pagination?.questions ?? emptyPagination(QUESTION_PAGE_SIZE));
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        }
        console.error("Error fetching analysis data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      fetchAnalysisData();
    }
  }, [roomId]);

  // ── Live overview updates 
  useEffect(() => {
    if (!roomId || !currentUser?.uid) return;

    // Pass user UID so the backend can verify hasAccess.
    socket.emit('join-room', { roomCode: roomId, user: currentUser.uid, role: 'teacher' });

    // overview-analytics-updated receives the exact MongoDB aggregation 
    // object for the overview stats (debounced to save DB load).
    const handleOverviewAnalyticsUpdated = async (newOverview: any) => {
      // 1. Instantly ping the overview stats for responsive UI
      setAnalysisData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          overview: newOverview,
        };
      });

      // 2. Silently fetch the rest of the dashboard so the Charts update with new data logs
      // Add a timestamp cache-buster so the browser doesn't swallow the GET request
      try {
        const response = await api.get(`/livequizzes/rooms/${roomId}/analysis?_t=${Date.now()}`);
        if (response.data.success) {
          const dashboard = response.data.data.dashboard;
          console.log('[Live Refresh] Fetched fresh dashboard:', dashboard);
          setAnalysisData(prev => {
            if (!prev) return prev;
            return {
              ...dashboard,
              overview: newOverview // Keep the perfectly real-time overview object
            };
          });
        }
      } catch (error) {
        console.error("Failed to silently refresh chart data:", error);
      }
    };

    socket.on('overview-analytics-updated', handleOverviewAnalyticsUpdated);

    return () => {
      socket.off('overview-analytics-updated', handleOverviewAnalyticsUpdated);
      socket.emit('leave-room', roomId, null);
    };
  }, [roomId, currentUser?.uid]);

  useEffect(() => {
    const fetchFilteredStudents = async () => {
      try {
        setStudentLoading(true);
        const response = await api.get(`/livequizzes/rooms/${roomId}/analysis`, {
          params: {
            studentSortBy,
            studentSortOrder,
            studentSearch: deferredSearchQuery,
            studentAccuracyBand: accuracyFilter,
            studentParticipation: participationFilter,
            studentPage,
            studentPageSize: STUDENT_PAGE_SIZE,
          },
        });
        const result = response.data;

        if (result.success) {
          setStudents(result.data.dashboard.students);
          setStudentPagination(result.data.dashboard.pagination.students);
        }
      } catch (err) {
        console.error("Error fetching filtered students:", err);
      } finally {
        setStudentLoading(false);
      }
    };

    if (roomId) {
      fetchFilteredStudents();
    }
  }, [roomId, studentSortBy, studentSortOrder, deferredSearchQuery, accuracyFilter, participationFilter, studentPage]);

  useEffect(() => {
    const fetchPaginatedQuestions = async () => {
      try {
        setQuestionLoading(true);
        const response = await api.get(`/livequizzes/rooms/${roomId}/analysis`, {
          params: {
            questionPage,
            questionPageSize: QUESTION_PAGE_SIZE,
          },
        });
        const result = response.data;

        if (result.success) {
          setQuestions(result.data.dashboard.questions);
          setQuestionPagination(result.data.dashboard.pagination.questions);
        }
      } catch (err) {
        console.error("Error fetching paginated questions:", err);
      } finally {
        setQuestionLoading(false);
      }
    };

    if (roomId) {
      fetchPaginatedQuestions();
    }
  }, [roomId, questionPage]);

  const handleStudentSort = (key: StudentSortBy) => {
    if (studentSortBy === key) {
      setStudentSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setStudentSortBy(key);
    setStudentSortOrder(key === "avgTime" ? "asc" : "desc");
  };

  const scoreDistribution = useMemo(() => {
    const dist = [
      { label: "< 500", value: 0 },
      { label: "500-1k", value: 0 },
      { label: "1k-2k", value: 0 },
      { label: "2k-3k", value: 0 },
      { label: "> 3k", value: 0 },
    ];

    analysisData?.students.forEach((s) => {
      if (s.points < 500) dist[0].value++;
      else if (s.points < 1000) dist[1].value++;
      else if (s.points < 2000) dist[2].value++;
      else if (s.points < 3000) dist[3].value++;
      else dist[4].value++;
    });

    return dist;
  }, [analysisData?.students]);

  const engagementData = useMemo<LineChartPoint[]>(() => {
    return (analysisData?.questions ?? []).map((question, index) => ({
      label: `Q${index + 1}`,
      value: Math.round(question.engagementPct),
      tooltip: question.text,
    }));
  }, [analysisData?.questions]);

  const engagementSummary = useMemo(() => {
    if (!engagementData.length) {
      return null;
    }

    const total = engagementData.reduce((sum, point) => sum + point.value, 0);
    const average = Math.round(total / engagementData.length);
    const lowestPoint = engagementData.reduce((lowest, point) => (point.value < lowest.value ? point : lowest));

    return { average, lowestPoint };
  }, [engagementData]);

  const insightData = useMemo(() => {
    const allQuestions = analysisData?.questions ?? [];
    const allStudents = analysisData?.students ?? [];
    const badges = analysisData?.achievements?.badges ?? [];

    const lowestAccuracyQuestion = allQuestions.length
      ? allQuestions.reduce((lowest, question) => (question.correctPct < lowest.correctPct ? question : lowest))
      : null;

    const highestEngagementQuestion = allQuestions.length
      ? allQuestions.reduce((highest, question) => (question.engagementPct > highest.engagementPct ? question : highest))
      : null;

    const averageResponseTimeSeconds = allStudents.length
      ? Math.round(allStudents.reduce((sum, student) => sum + student.totalTime, 0) / allStudents.length)
      : 0;

    const speedBadge = badges.find((badge) => badge.name.toLowerCase().includes("speed"));

    const averageQuestionAccuracy = allQuestions.length
      ? Math.round(allQuestions.reduce((sum, question) => sum + question.correctPct, 0) / allQuestions.length)
      : 0;

    return {
      lowestAccuracyQuestion,
      highestEngagementQuestion,
      averageResponseTimeSeconds,
      speedBadgeEarned: speedBadge?.earned ?? 0,
      averageQuestionAccuracy,
    };
  }, [analysisData]);

  const getStudentAccuracy = (student: StudentStats) => {
    if (!student.attempted) {
      return 0;
    }

    return Math.round((student.correct / student.attempted) * 100);
  };

  const isAnalysisEmpty =
    !!analysisData &&
    (analysisData.overview.questionsAsked ?? 0) === 0 &&
    (analysisData.students?.length ?? 0) === 0 &&
    (analysisData.questions?.length ?? 0) === 0 &&
    (analysisData.achievements?.badges?.length ?? 0) === 0;

  const downloadExcel = () => {
    const data = analysisData?.students.map((p) => ({
      Rank: p.rank,
      Name: p.name,
      Score: p.points,
      Attempted: p.attempted,
      Correct: p.correct,
      Wrong: p.incorrect,
      UnAttempted: p.unAttempted,
      Missed: p.missed,
      "Time Taken": p.totalTime,
    }));

    const ws = XLSX.utils.json_to_sheet(data as never[]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analysis");
    const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
    saveAs(blob, `${analysisData?.overview.name}-analysis.xlsx`);
  };

  return (
    <div className="w-full flex flex-col font-sans relative pb-24 bg-transparent">
      {loading && !analysisData ? (
        <LoadingState message="Loading room analysis..." />
      ) : error && !analysisData ? (
        <EmptyState title="Could not load analysis" message={error} />
      ) : isAnalysisEmpty ? (
        <EmptyState
          title="No analysis yet"
          message="This room does not have enough responses yet to generate analytics. Once students start participating, the summaries and tables will appear here."
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                  {`${analysisData?.overview.roomCode}-${analysisData?.overview.name}`}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 border ${
                    analysisData?.overview.status === "active"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {analysisData?.overview.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {analysisData?.overview.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 mb-4 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  <Hash size={14} className="text-indigo-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{analysisData?.overview.roomCode}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  <span>{formatDate(analysisData?.overview?.createdAt ?? "")}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock size={14} className={analysisData?.overview.status === "active" ? "text-emerald-500" : ""} />
                  {analysisData?.overview.status === "active" ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      Running: <LiveTimer className="text-emerald-500 font-semibold" createdAt={analysisData.overview.createdAt} />
                    </span>
                  ) : (
                    <span>Duration: 0</span>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 capitalize">{activeTab} Analytics</h3>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent active:scale-95"
                onClick={downloadExcel}
              >
                <FileSpreadsheet size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>Export Report</span>
              </button>
            </div>
          </div>

          <div className="w-full">
            {activeTab === "overview" && (
              <OverviewTab
                analysisData={analysisData}
                engagementData={engagementData}
                engagementSummary={engagementSummary}
                scoreDistribution={scoreDistribution}
                insightData={insightData}
              />
            )}
            {activeTab === "students" && (
              <StudentAnalyticsSection
                students={students}
                overview={analysisData?.overview ?? null}
                pagination={studentPagination}
                isLoading={studentLoading}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                accuracyFilter={accuracyFilter}
                setAccuracyFilter={setAccuracyFilter}
                participationFilter={participationFilter}
                setParticipationFilter={setParticipationFilter}
                studentSortBy={studentSortBy}
                studentSortOrder={studentSortOrder}
                handleStudentSort={handleStudentSort}
                getStudentAccuracy={getStudentAccuracy}
                onPageChange={setStudentPage}
              />
            )}
            {activeTab === "questions" && (
              <QuestionsTab
                questions={questions}
                totalStudents={analysisData?.overview?.totalStudents ?? 0}
                pagination={questionPagination}
                isLoading={questionLoading}
                onPageChange={setQuestionPage}
              />
            )}
            {activeTab === "achievements" && <AchievementsTab analysisData={analysisData} />}
          </div>

          <DraggableMenu activeTab={activeTab} setActiveTab={setActiveTab} />
        </>
      )}
    </div>
  );
}
