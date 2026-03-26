import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useState, useEffect } from "react";
import { BookOpen, TrendingUp, Calendar, Trophy, Clock, CheckCircle, BarChart2, AlertCircle, ShieldCheck, ArrowRightCircle, Target, Award } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import api from "@/lib/api/api";

export interface StudentData {
  pollStats: {
    total: number;
    taken: number;
    absent: number;
    unattempted: number;
    earnedPoints: number;
  };
  pollResults: {
    name: string;
    subject: string;
    score: number;
    date: string;
    maxPoints: number;
    points: number;
  }[];
  pollDetails: {
    title: string;
    type: string;
    timer: string;
  }[];
  activePolls: {
    name: string;
    status: string;
  }[];
  upcomingPolls: {
    name: string;
    time: string;
  }[];
  scoreProgression: {
    poll: string;
    score: number;
    maxPoints: number;
  }[];
  performanceSummary: {
    avgScore: string;
    participationRate: string;
    bestSubject: string;
  };
  roomWiseScores: {
    roomName: string;
    roomCode: string;
    totalPolls: number;
    attendedPolls: number;
    taken: number;
    score: number;
    maxPossiblePoints: number;
    avgScore: number;
    averageScore: string;
    status: string;
    createdAt: Date;
  }[];
}

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [isDark] = useState(false);
  const [dashboardData, setDashboardData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localActiveRoom, setLocalActiveRoom] = useState<string | null>(null);
  const navigate = useNavigate();
  const [achievementProgress, setAchievementProgress] = useState({ earned: 0, total: 0, percent: 0 });

  useEffect(() => {
    const activeRoomCode = localStorage.getItem("activeRoomCode");
    const joinedRoom = localStorage.getItem("joinedRoom");
    if (activeRoomCode && joinedRoom === "true") {
      setLocalActiveRoom(activeRoomCode);
    }
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const studentId = user?.uid;
      if (!studentId) {
        throw new Error('No student ID found');
      }

      const response = await api.get(`/students/dashboard/${studentId}`);
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievementProgress = async () => {
    if (!user?.uid) return;

    try {
      const res = await api.get(`/students/dashboard/achievement/${user.uid}/progress`);
      setAchievementProgress({
        earned: res.data?.earned || 0,
        total: res.data?.total || 0,
        percent: res.data?.percent || 0,
      });
    } catch (e) {
      console.error("Failed to load achievement progress:", e);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData();
      fetchAchievementProgress();
    }
  }, [user?.uid]);

  useEffect(() => {
    const handleWindowFocus = () => {
      if (user?.uid) {
        const activeRoomCode = localStorage.getItem("activeRoomCode");
        const joinedRoom = localStorage.getItem("joinedRoom");
        if (activeRoomCode && joinedRoom === "true") {
          api.get(`/livequizzes/rooms/${activeRoomCode}`)
            .then((res) => {
              if (res.data?.success && res.data.room?.status === 'active') {
                setLocalActiveRoom(activeRoomCode);
              } else {
                localStorage.removeItem("activeRoomCode");
                localStorage.removeItem("joinedRoom");
                setLocalActiveRoom(null);
              }
            })
            .catch(() => {
              localStorage.removeItem("activeRoomCode");
              localStorage.removeItem("joinedRoom");
              setLocalActiveRoom(null);
            });
        } else {
          setLocalActiveRoom(null);
        }

        fetchDashboardData();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [user?.uid]);

  // Loading state
  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="p-6 max-w-md mx-auto bg-white dark:bg-slate-800 border-red-200 dark:border-red-800">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Error Loading Dashboard</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // No data state
  if (!dashboardData) {
    return (
      <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="p-6 max-w-md mx-auto bg-white dark:bg-slate-800">
            <div className="text-center">
              <BarChart2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-2">No Data Available</h2>
              <p className="text-gray-600 dark:text-gray-400">Dashboard data not found.</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const {
    pollStats,
    pollResults,
    pollDetails,
    //activePolls,
    upcomingPolls,
    scoreProgression,
    performanceSummary,
    roomWiseScores
  } = dashboardData;

  //const projectColors = isDark ? ["#3b82f6", "#f59e0b", "#10b981", "#f43f5e"] : ["#6366f1", "#f59e42", "#059669", "#e11d48"];

  const themeClasses = isDark ? 'dark' : '';

  return (
    <div className={`${themeClasses} transition-colors duration-300`}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 min-h-screen">

        {/* Error banner if there was an error but we have fallback data */}
        {error && dashboardData && (
          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">Using cached data. Some information may be outdated.</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Row: Welcome Banner and Poll Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Welcome Banner */}
          <Card className="lg:col-span-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative overflow-hidden shadow-lg dark:shadow-2xl border-0">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 right-1/4 -mb-10 w-32 h-32 bg-indigo-400 opacity-20 rounded-full blur-xl"></div>

            <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 sm:p-8 min-h-[200px] sm:h-64 relative z-10">
              {/* Left: Text */}
              <div className="w-full sm:w-1/2 flex flex-col justify-center text-center sm:text-left mb-6 sm:mb-0">
                <h2 className="text-2xl sm:text-3xl font-extrabold mb-1 drop-shadow-sm tracking-tight text-white/95">
                  Welcome Back, <span className="capitalize text-white">{user?.firstName || 'Student'}!</span>
                </h2>
                <p className="mb-6 text-sm sm:text-base font-medium opacity-80 drop-shadow-sm text-blue-50">
                  Ready to test your knowledge? Jump into a live room and start learning!
                </p>
                <Button
                  className="bg-white hover:bg-slate-50 text-blue-700 font-bold shadow-xl border border-transparent hover:border-blue-100 w-fit transition-all duration-300 transform hover:scale-105 mx-auto sm:mx-0 rounded-full px-6 py-5 flex items-center gap-2 group"
                  onClick={() => {
                    navigate({ to: '/student/pollroom' });
                  }}
                  data-tour="join-room-btn"
                >
                  Join Poll Room
                  <ArrowRightCircle className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              {/* Right: Graphic */}
              <div className="w-full sm:w-1/2 flex items-center justify-center relative">
                <div className="absolute w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
                <div className="w-32 h-32 sm:w-44 sm:h-44 bg-white/10 border border-white/20 rounded-full flex flex-col items-center justify-center backdrop-blur-md relative overflow-hidden transform hover:rotate-6 transition-all duration-500 shadow-2xl">
                  <BarChart2 className="w-12 h-12 sm:w-16 sm:h-16 text-white drop-shadow-lg mb-2" />
                  <span className="text-white/80 font-semibold text-sm tracking-wide">YOUR STATS</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Poll Stats Summary - Restructured to grid blocks */}
          <div className="flex flex-col h-full space-y-3 sm:space-y-4" data-tour="poll-stats">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1">
              {/* Total Polls Widget */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center group hover:border-blue-200 dark:hover:border-blue-700 transition-all">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <BarChart2 className="w-6 h-6" />
                </div>
                <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{pollStats?.total || 0}</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Total Polls</div>
              </div>

              {/* Earned Points Widget */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 rounded-2xl p-4 shadow-sm border border-amber-100 dark:border-amber-800/30 flex flex-col items-center justify-center text-center group hover:border-amber-200 dark:hover:border-amber-700/50 transition-all">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="text-3xl font-extrabold text-amber-700 dark:text-amber-500 tracking-tight">{pollStats?.earnedPoints || 0}</div>
                <div className="text-xs font-semibold text-amber-600/80 dark:text-amber-500/80 uppercase tracking-wider mt-1">Earned Points</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 h-24">
              {/* Mini Stats */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors">
                <CheckCircle className="w-5 h-5 text-emerald-500 mb-1" />
                <div className="font-bold text-lg text-slate-800 dark:text-slate-100">{pollStats?.taken || 0}</div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Taken</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center hover:bg-rose-50/50 dark:hover:bg-rose-900/10 transition-colors">
                <Clock className="w-5 h-5 text-rose-500 mb-1" />
                <div className="font-bold text-lg text-slate-800 dark:text-slate-100">{pollStats?.absent || 0}</div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Absent</div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl p-2 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-colors">
                <AlertCircle className="w-5 h-5 text-orange-500 mb-1" />
                <div className="font-bold text-lg text-slate-800 dark:text-slate-100">{pollStats?.unattempted || 0}</div>
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Missed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Poll Results, Poll Details, Active Polls, Upcoming Polls */}
        {/* Middle Row: Recent Polls + Active Rooms + Upcoming Polls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

          {/* Recent Polls (combined box) */}
          <Card className="md:col-span-2 shadow-md dark:shadow-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" data-tour="active-polls">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-blue-700 dark:text-blue-400 flex items-center gap-2 text-sm sm:text-base">
                <Trophy className="h-5 w-5" />
                Recent Polls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pollResults && pollResults.length > 0 ? (
                [...pollResults]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 4)
                  .map((poll, idx) => (
                    <div
                      key={`${poll.name}-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3 sm:mb-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shrink-0 group-hover:scale-110 transition-transform">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base">{poll.name}</div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {new Date(poll.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 pl-12 sm:pl-0">
                        <div className="flex items-center px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                          <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">{poll.points}</span>
                          <span className="mx-1 text-slate-400">/</span>
                          <span className="text-xs sm:text-sm font-medium text-slate-500">{poll.maxPoints}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {pollDetails[idx]?.timer || "N/A"}s
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Trophy className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recent polls</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Rooms */}
          <Card className="shadow-md dark:shadow-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-700 dark:text-blue-400 flex items-center gap-2 text-sm sm:text-base">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Active Rooms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Show local active room from localStorage if it exists */}
              {localActiveRoom && (
                <div
                  className="group relative overflow-hidden flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 border-2 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => navigate({ to: `/student/pollroom/${localActiveRoom}` })}
                >
                  <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-emerald-400/20 blur-xl rounded-full"></div>
                  <div className="relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse relative">
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></div>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-emerald-900 dark:text-emerald-100 text-sm sm:text-base group-hover:text-emerald-700 transition-colors">Room {localActiveRoom}</div>
                      <div className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400 mt-0.5">Click to rejoin session</div>
                    </div>
                  </div>
                  <ArrowRightCircle className="w-5 h-5 text-emerald-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all font-bold" />
                </div>
              )}

              {/* Show backend active rooms */}
              {roomWiseScores && roomWiseScores.filter(r => r.status === 'active').length > 0 ? (
                roomWiseScores
                  .filter(r => r.status === 'active')
                  .filter(r => r.roomCode !== localActiveRoom) // Avoid duplicates
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((room, idx) => (
                    <div
                      key={`${room.roomCode}-${idx}`}
                      className="group relative overflow-hidden flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-800 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => navigate({ to: `/student/pollroom/${room.roomCode}` })}
                    >
                      <div className="relative z-10 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base truncate group-hover:text-blue-600 transition-colors">{room.roomName}</div>
                          <div className="text-xs font-semibold text-blue-600/80 dark:text-blue-400 mt-0.5">Open recently</div>
                        </div>
                      </div>
                      <ArrowRightCircle className="w-5 h-5 text-blue-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all font-bold shrink-0" />
                    </div>
                  ))
              ) : !localActiveRoom ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-gray-400 mx-auto mb-2"></div>
                  <p>No active rooms</p>
                  <Button
                    onClick={() => navigate({ to: '/student/pollroom' })}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Join a Room
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Upcoming Polls (keep as-is) */}
          <Card className="shadow-md dark:shadow-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-700 dark:text-blue-400 flex items-center gap-2 text-sm sm:text-base">
                <Calendar className="h-5 w-5" />
                Upcoming Polls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingPolls && upcomingPolls.length > 0 ? (
                upcomingPolls.map((poll, idx) => (
                  <div
                    key={`${poll.name}-${idx}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500 shrink-0 group-hover:rotate-12 transition-transform">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base truncate">{poll.name}</div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {poll.time}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No upcoming polls</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Score Progression and Room-wise Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Score Progression */}
          <Card className="shadow-md dark:shadow-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400 flex items-center gap-2 text-sm sm:text-base">
                <TrendingUp className="h-5 w-5" />
                Score Progression
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64 sm:h-72 p-0 flex items-center justify-center">
              {scoreProgression && scoreProgression.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreProgression} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="poll"
                      tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }}
                      axisLine={{ stroke: isDark ? '#4b5563' : '#d1d5db' }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: isDark ? '#9ca3af' : '#6b7280' }}
                      axisLine={{ stroke: isDark ? '#4b5563' : '#d1d5db' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                        borderRadius: '8px',
                        color: isDark ? '#f3f4f6' : '#1f2937'
                      }}
                      formatter={(value: any, name: any, props: any) => [
                        `${value} / ${props.payload?.maxPoints || 20}`,
                        'Score'
                      ]}
                    />
                    <Bar
                      dataKey="score"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No score progression data</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Room-wise Results */}
          <Card className="shadow-md dark:shadow-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" data-tour="room-scores">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-400 flex items-center gap-2 text-sm sm:text-base">
                <BookOpen className="h-5 w-5" />
                Room-wise Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {roomWiseScores && roomWiseScores.length > 0 ? (
                <div className="grid gap-4">
                  {roomWiseScores.map((room, idx) => (
                    <div key={room.roomCode || idx} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                              <BookOpen className="w-4 h-4" />
                            </span>
                            {room.roomName}
                          </h3>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                            Room Code: <span className="font-medium tracking-wide">{room.roomCode}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-baseline gap-1 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-100 dark:border-green-800">
                            <Award className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-lg font-bold text-green-700 dark:text-green-400">
                              {room.score}
                            </span>
                            <span className="text-sm font-medium text-green-600/70 dark:text-green-500">
                              / {room.maxPossiblePoints} pts
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Attendance Stats */}
                        <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Participation</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {room.totalPolls > 0 ? Math.round(((room.taken || room.attendedPolls || 0) / room.totalPolls) * 100) : 0}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <div
                              className="bg-indigo-500 dark:bg-indigo-400 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${room.totalPolls > 0 ? ((room.taken || room.attendedPolls || 0) / room.totalPolls) * 100 : 0}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 text-right">
                            {room.taken || room.attendedPolls || 0} of {room.totalPolls} polls
                          </div>
                        </div>

                        {/* Performance Stats */}
                        <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1"><Target className="w-3 h-3" /> Accuracy</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {room.averageScore || '0%'}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${parseInt(room.averageScore) || 0}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 text-right">
                            Avg. score
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No room results available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Summary */}
        <Card className="shadow-md dark:shadow-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" data-tour="performance-summary">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 font-bold flex items-center gap-2 text-sm sm:text-base">
              <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-xl border-2 border-green-100 dark:border-green-800/30 flex flex-col items-center text-center group hover:border-green-300 dark:hover:border-green-700 transition-colors">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-800/50 flex flex-col items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-widest mb-1">Average Score</div>
                <div className="text-3xl font-black text-green-600 dark:text-green-400 mb-2 drop-shadow-sm">
                  {performanceSummary?.avgScore || '0%'}
                </div>
                <div className="text-xs font-semibold px-3 py-1 bg-green-100 dark:bg-green-800/40 rounded-full text-green-700 dark:text-green-300">
                  {(() => {
                    const score = parseInt(performanceSummary?.avgScore || '0');
                    if (score >= 80) return 'Excellent performance 🚀';
                    if (score >= 60) return 'Good performance 👍';
                    return 'Keep improving 💪';
                  })()}
                </div>
              </div>
              <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border-2 border-blue-100 dark:border-blue-800/30 flex flex-col items-center text-center group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-800/50 flex flex-col items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-1">Participation Rate</div>
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-2 drop-shadow-sm">
                  {performanceSummary?.participationRate || '0%'}
                </div>
                <div className="text-xs font-semibold px-3 py-1 bg-blue-100 dark:bg-blue-800/40 rounded-full text-blue-700 dark:text-blue-300">
                  Attempted {pollStats?.taken || 0} out of {pollStats?.total || 0} polls
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="mb-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-0 shadow-xl shadow-indigo-500/10">
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 font-bold flex items-center justify-between gap-2 text-sm sm:text-base">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Achievements
              </span>
              <button
                type="button"
                onClick={() => navigate({ to: '/student/badges' })}
                className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                aria-label="Go to badges page"
                title="Go to badges"
              >
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[120px] group-hover:opacity-100 text-xs font-semibold">
                  Your achievements
                </span>
                <ArrowRightCircle className="h-5 w-5" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-300">
                {achievementProgress.earned}/{achievementProgress.total}
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-linear-to-r from-slate-200 to-slate-300 dark:from-gray-700 dark:to-gray-600 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-indigo-500 via-blue-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${achievementProgress.percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Progress</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-300">{achievementProgress.percent}% complete</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
