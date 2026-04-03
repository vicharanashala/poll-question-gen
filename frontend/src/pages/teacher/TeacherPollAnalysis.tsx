import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Calendar, Clock, FileSpreadsheet, Hash } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import socket from "@/lib/api/socket";
import api from "@/lib/api/api";
import { Overview } from "@/shared/types";
import LiveTimer from "@/components/LiveTimer";
import { formatDate } from "@/utils/formatDate";
import { AchievementsTab } from "./RoomAnalysis/AchievementsTab";
import { DraggableMenu } from "./RoomAnalysis/DraggableMenu";
import { OverviewTab } from "./RoomAnalysis/OverviewTab";
import { QuestionsTab } from "./RoomAnalysis/QuestionsTab";
import { EmptyState, LoadingState } from "./RoomAnalysis/States";
import { StudentAnalyticsSection } from "./RoomAnalysis/StudentAnalyticsSection";
import { useAuthStore } from "@/lib/store/auth-store";
import { useRoomAchievements, useRoomOverview, useRoomQuestions, useRoomStudents } from "@/lib/api/roomAnalysisHooks";

export default function TeacherPollAnalysis() {
  const { roomId } = useParams({ from: "/teacher/manage-rooms/pollanalysis/$roomId" });
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState("overview");
  const [isExporting, setIsExporting] = useState(false);

  const overviewQuery = useRoomOverview(roomId);

  // Prefetch all analysis data
  const achievementsQuery = useRoomAchievements(roomId);
  const studentsQuery = useRoomStudents(roomId, { studentPage: 1, studentPageSize: 10 });
  const questionsQuery = useRoomQuestions(roomId, { questionPage: 1, questionPageSize: 5 });

  const [liveOverview, setLiveOverview] = useState<Overview | null>(null);
  const [overviewSnapshot, setOverviewSnapshot] = useState<Overview | null>(null);

  useEffect(() => {
    if (!overviewQuery.data) return;
    setLiveOverview(overviewQuery.data);
    setOverviewSnapshot(overviewQuery.data);
  }, [overviewQuery.data]);

  useEffect(() => {
    if (!roomId || !currentUser?.uid) return;

    socket.emit("join-room", { roomCode: roomId, user: currentUser.uid, role: "teacher" });

    const handleOverviewAnalyticsUpdated = (nextOverview: unknown) => {
      // Keep "live" updates in the header, but don't drive chart updates.
      if (nextOverview && typeof nextOverview === "object") {
        setLiveOverview(nextOverview as Overview);
      }
    };

    const handleTotalStudentsUpdated = (data: { totalStudents: number }) => {
      setLiveOverview(prev => prev ? { ...prev, totalStudents: data.totalStudents } : null);
    };

    const handleTotalCohostsUpdated = (data: { totalCohosts: number }) => {
      setLiveOverview(prev => prev ? { ...prev, totalCohosts: data.totalCohosts } : null);
    };

    const handleQuestionsAskedUpdated = (data: { questionsAsked: number; pointsDistributed?: number }) => {
      setLiveOverview(prev => prev ? { 
        ...prev, 
        questionsAsked: (prev.questionsAsked || 0) + data.questionsAsked,
        pointsDistributed: (prev.pointsDistributed || 0) + (data.pointsDistributed || 0)
      } : null);
    };

    const handleAvgAccuracyUpdated = (data: { avgAccuracy: number }) => {
      setLiveOverview(prev => prev ? { ...prev, avgAccuracy: data.avgAccuracy } : null);
    };

    socket.on("overview-analytics-updated", handleOverviewAnalyticsUpdated);
    socket.on("total-students-updated", handleTotalStudentsUpdated);
    socket.on("total-cohosts-updated", handleTotalCohostsUpdated);
    socket.on("questions-asked-updated", handleQuestionsAskedUpdated);
    socket.on("avg-accuracy-updated", handleAvgAccuracyUpdated);

    return () => {
      socket.off("overview-analytics-updated", handleOverviewAnalyticsUpdated);
      socket.off("total-students-updated", handleTotalStudentsUpdated);
      socket.off("total-cohosts-updated", handleTotalCohostsUpdated);
      socket.off("questions-asked-updated", handleQuestionsAskedUpdated);
      socket.off("avg-accuracy-updated", handleAvgAccuracyUpdated);
      socket.emit("leave-room", roomId, null);
    };
  }, [roomId, currentUser?.uid]);

  const overview = liveOverview ?? overviewQuery.data ?? null;
  const loading = overviewQuery.isLoading;
  const error = overviewQuery.error instanceof Error ? overviewQuery.error.message : null;

  const isAnalysisEmpty = !!overview && (overview.questionsAsked ?? 0) === 0;

  const downloadExcel = async () => {
    if (!overview) return;
    try {
      setIsExporting(true);
      const response = await api.get(`/livequizzes/rooms/${roomId}/analysis/students`, {
        params: { studentPageSize: 10000 },
      });
      const dataToExport = response.data.data?.items;
      if (!dataToExport || !dataToExport.length) throw new Error("No student data found");

      const data = dataToExport.map((p: any) => ({
        Rank: p.rank,
        Name: p.name,
        Score: p.points,
        Attempted: p.attempted,
        Correct: p.correct,
        Wrong: p.incorrect,
        UnAttempted: p.unAttempted,
        Missed: p.missed,
        "Time Taken (s)": p.totalTime,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analysis");
      const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
      saveAs(blob, `${overview.name}-analysis.xlsx`);
    } catch (err) {
      console.error("Failed to export:", err);
      alert("Failed to export report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full flex flex-col font-sans relative pb-24 bg-transparent">
      {loading && !overview ? (
        <LoadingState message="Loading room analysis..." />
      ) : error && !overview ? (
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
                  {`${overview?.roomCode}-${overview?.name}`}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 border ${
                    overview?.status === "active"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {overview?.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {overview?.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 mb-4 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                  <Hash size={14} className="text-indigo-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{overview?.roomCode}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar size={14} />
                  <span>{formatDate(overview?.createdAt ?? "")}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Clock size={14} className={overview?.status === "active" ? "text-emerald-500" : ""} />
                  {overview?.status === "active" ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      Running: <LiveTimer className="text-emerald-500 font-semibold" createdAt={overview.createdAt} />
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
                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent active:scale-95 disabled:opacity-50"
                onClick={downloadExcel}
                disabled={isExporting}
              >
                <FileSpreadsheet size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>{isExporting ? "Exporting..." : "Export Report"}</span>
              </button>
            </div>
          </div>

          <div className="w-full">
            {activeTab === "overview" && (
              <OverviewTab roomId={roomId} overview={overview} chartSnapshot={overviewSnapshot} />
            )}
            {activeTab === "students" && <StudentAnalyticsSection roomId={roomId} questionsAsked={overview?.questionsAsked || 0} isActive={activeTab === "students"} />}
            {activeTab === "questions" && <QuestionsTab roomId={roomId} totalStudents={overview?.totalStudents || 0} isActive={activeTab === "questions"} />}
            {activeTab === "achievements" && <AchievementsTab roomId={roomId} isActive={activeTab === "achievements"} />}
          </div>

          <DraggableMenu activeTab={activeTab} setActiveTab={setActiveTab} />
        </>
      )}
    </div>
  );
}
