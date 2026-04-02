import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useState, useEffect } from "react";
import { TrendingUp, Clock, Award, ShieldCheck, BarChart2, BookOpen, ArrowRightCircle, Target, Trophy, AlertCircle, CheckCircle, Calendar } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import api from "@/lib/api/api";
import { getBadgeTier } from "@/shared/getBadgeTier";
import socket from "@/lib/api/socket";

export interface StudentData {
  pollStats: {
    total: number;
    taken: number;
    absent: number;
    unattempted: number;
    earnedPoints: number;
    correctAnswers: number;
    incorrectAnswers: number;
    avgResponseTime: string;
  };
  pollResults: {
    name: string;
    subject: string;
    score: number;
    date: string;
    maxPoints: number;
    points: number;
    isCorrect: boolean;
    timer?: number;
    type?: string;
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
    avgResponseTime: string;
    bestSubject: string;
  };
  achievements: {
    totalEarned: number;
    recentAchievements: any[];
    upcomingBadge: any;
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
    avgResponseTime: string;
    badgesCount: number;
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

  useEffect(() => {
    if (user?.uid) {
      fetchDashboardData();
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

  const renderBadgeIcon = (badge: any, size: "sm" | "md" | "lg" = "md") => {
    if (!badge) return <div className="text-2xl">🏆</div>;

    // Check if there's an actual image file override
    const iconStr = badge.icon || "";
    const isImage = iconStr.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
    if (isImage) {
      const imgSize = size === "sm" ? "w-6 h-6" : size === "md" ? "w-8 h-8" : "w-12 h-12";
      return <img src={iconStr.startsWith('http') ? iconStr : `/badges/${iconStr}`} alt="Badge" className={`${imgSize} object-contain`} />;
    }

    // Use getBadgeTier for Lucide icons and styling
    const tier = getBadgeTier(badge.category, badge.name);
    const Icon = tier.Icon;
    const containerSize = size === "sm" ? "h-10 w-10" : size === "md" ? "h-12 w-12" : "h-16 w-16";
    const iconSize = size === "sm" ? "w-5 h-5" : size === "md" ? "w-6 h-6" : "w-8 h-8";

    return (
      <div className={`flex ${containerSize} items-center justify-center rounded-full bg-gradient-to-br shadow-md transition-transform duration-300 ${tier.iconContainer}`}>
        <Icon className={`${iconSize} ${tier.iconColor}`} />
      </div>
    );
  };

  // Sync active room from backend if local storage is empty (e.g., incognito/new device)
  useEffect(() => {
    if (!localActiveRoom && dashboardData?.roomWiseScores) {
      const activeRooms = dashboardData.roomWiseScores
        .filter(r => r.status === 'active')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (activeRooms.length > 0) {
        setLocalActiveRoom(activeRooms[0].roomCode);
        // Also persist it for this session's local storage to prevent flickering
        localStorage.setItem("activeRoomCode", activeRooms[0].roomCode);
        localStorage.setItem("joinedRoom", "true");
      }
    }
  }, [dashboardData, localActiveRoom]);

  // Real-time Dashboard Updates
  useEffect(() => {
    if (!user?.uid) return;

    // Join personal room for targeted real-time events
    socket.emit('join-user-room', user.uid);

    const handleDashboardUpdate = (data: any) => {
      console.log('Real-time dashboard update received:', data);
      fetchDashboardData();
    };

    socket.on('dashboard-update', handleDashboardUpdate);

    return () => {
      socket.off('dashboard-update', handleDashboardUpdate);
    };
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
    //activePolls,
    upcomingPolls,
    scoreProgression,
    performanceSummary,
    achievements,
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

        {/* Performance Summary Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="performance-summary">
          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm overflow-hidden group">
            <div className="h-1 bg-blue-500 w-full" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 transition-transform group-hover:scale-110">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accuracy</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{performanceSummary?.avgScore || '0%'}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm overflow-hidden group">
            <div className="h-1 bg-indigo-500 w-full" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 transition-transform group-hover:scale-110">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Response</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{performanceSummary?.avgResponseTime || '0'}s</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm overflow-hidden group">
            <div className="h-1 bg-emerald-500 w-full" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Poll Participation</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{performanceSummary?.participationRate || '0%'}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm overflow-hidden group">
            <div className="h-1 bg-amber-500 w-full" />
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Badges Earned</p>
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{achievements?.totalEarned || 0}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievement Showcase & Question Interaction */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Achievement Showcase */}
          <Card className="lg:col-span-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-slate-200 dark:border-slate-700 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-slate-800 dark:text-slate-100 font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-500" />
                Achievement Showcase
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/student/badges' })} className="text-blue-600 font-semibold hover:bg-blue-50">
                View All <ArrowRightCircle className="ml-1 w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Recent Achievements */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recently Earned</h4>
                  <div className="space-y-3">
                    {achievements?.recentAchievements && achievements.recentAchievements.length > 0 ? (
                      achievements.recentAchievements.slice(0, 3).map((ach: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 group hover:border-indigo-200 transition-all">
                          {renderBadgeIcon(ach.badgeId, "sm")}
                          <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{ach.badgeId?.name}</div>
                            <div className="text-[10px] text-slate-500 font-medium">Earned in Room {ach.roomCode}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400">Keep participating to earn badges!</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upcoming Badge */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Next Milestone</h4>
                  {achievements?.upcomingBadge ? (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform duration-500">
                        <Award className="w-16 h-16 text-indigo-600" />
                      </div>
                      <div className="relative z-10">
                        {renderBadgeIcon(achievements.upcomingBadge, "md")}
                        <h5 className="font-extrabold text-slate-800 dark:text-indigo-100 text-lg mt-3">{achievements.upcomingBadge.name}</h5>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 line-clamp-2">{achievements.upcomingBadge.description}</p>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-indigo-600 uppercase">Progress</span>
                            <span className="text-slate-400">Target: {achievements.upcomingBadge.rule?.threshold}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full animate-pulse transition-all duration-1000" style={{ width: `${achievements.upcomingBadge.progress || 0}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-slate-50 text-center border border-dashed border-slate-200">
                      <Trophy className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs text-slate-400 font-medium whitespace-pre-wrap">All known badges unlocked!\nYou're a master.</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question Interaction History */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl h-full">
            <CardHeader>
              <CardTitle className="text-slate-800 dark:text-slate-100 font-bold flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-blue-500" />
                Poll Interaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/40 text-center">
                    <div className="text-xs font-bold text-emerald-600 uppercase mb-1">Correct</div>
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{pollStats?.correctAnswers || 0}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/40 text-center">
                    <div className="text-xs font-bold text-rose-600 uppercase mb-1">Incorrect</div>
                    <div className="text-2xl font-black text-rose-700 dark:text-rose-400">{pollStats?.incorrectAnswers || 0}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-slate-500">Attempt Rate</span>
                    <span className="text-slate-800 dark:text-slate-100 font-bold">{performanceSummary.participationRate}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: performanceSummary.participationRate }} />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                        <Clock className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Response Speed</span>
                    </div>
                    <div className="text-lg font-black text-slate-800 dark:text-slate-100">{pollStats?.avgResponseTime || 0}s</div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Average time taken to answer each poll across all sessions.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Room-wise Results (Grid style with Badges) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
              <BookOpen className="w-5 h-5 text-indigo-500" /> Session Analytics
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/student/sessions' })}
              className="text-blue-600 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/40"
            >
              View All History <ArrowRightCircle className="ml-1 w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-tour="room-scores">
            {roomWiseScores && roomWiseScores.length > 0 ? (
              [...roomWiseScores]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map((room, idx) => (
                  <Card key={room.roomCode || idx} className="border-0 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all group overflow-hidden bg-white dark:bg-slate-800">
                    <div className={`h-1.5 w-full ${room.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">{room.roomName}</CardTitle>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {room.roomCode}</p>
                        </div>
                        {room.status === 'active' && (
                          <div className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700 animate-pulse">LIVE</div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Points</div>
                          <div className="text-sm font-black text-slate-700 dark:text-slate-200">{room.score}</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Badges</div>
                          <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">{room.badgesCount}</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-center">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">Speed</div>
                          <div className="text-sm font-black text-slate-700 dark:text-slate-200">{room.avgResponseTime}s</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-500 uppercase">Accuracy</span>
                            <span className={room.averageScore === '0%' ? 'text-rose-600' : 'text-blue-600'}>{room.averageScore}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${room.averageScore === '0%' ? 'bg-rose-500' : 'bg-blue-500'} rounded-full`} style={{ width: room.averageScore }} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          {(() => {
                            const participation = room.totalPolls > 0 ? Math.round((room.attendedPolls / room.totalPolls) * 100) : 0;
                            return (
                              <>
                                <div className="flex justify-between text-[10px] font-bold">
                                  <span className="text-slate-500 uppercase">Participation</span>
                                  <span className={participation === 0 ? 'text-rose-600' : 'text-emerald-600'}>{participation}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className={`h-full ${participation === 0 ? 'bg-rose-500' : 'bg-emerald-500'} rounded-full`} style={{ width: `${participation}%` }} />
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {room.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate({ to: `/student/pollroom/${room.roomCode}` })}
                          className="w-full rounded-xl border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 font-bold text-xs"
                        >
                          Rejoin <ArrowRightCircle className="ml-2 w-4 h-4" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
            ) : (
              <div className="col-span-full py-12 bg-white/50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-400 font-medium">No sessions found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts & Lists (Grouped) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
          {/* Score Progression */}
          <Card className="shadow-lg border-0 bg-white dark:bg-slate-800 overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
              <CardTitle className="text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-widest">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Score Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72 p-6">
              {scoreProgression && scoreProgression.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreProgression} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="poll"
                      hide
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value: any) => [
                        `${value} pts`,
                        'Score'
                      ]}
                    />
                    <Bar
                      dataKey="score"
                      fill="url(#colorScore)"
                      radius={[6, 6, 0, 0]}
                      minPointSize={6}
                      background={{ fill: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', radius: 6 }}
                    />
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <TrendingUp className="h-12 w-12 opacity-10 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">No Trend Data</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Interaction Log */}
          <Card className="shadow-lg border-0 bg-white dark:bg-slate-800 overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
              <CardTitle className="text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-widest">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Recent Poll Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-72 overflow-y-auto">
              {pollResults && pollResults.length > 0 ? (
                [...pollResults]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-900/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${item.isCorrect ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.isCorrect ? 'Correct' : 'Incorrect'} • {item.timer}s limit
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-black text-slate-600 dark:text-slate-400">+{item.points} pts</div>
                    </div>
                  ))
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <Clock className="w-10 h-10 mx-auto opacity-10 mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Activity Log Empty</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
