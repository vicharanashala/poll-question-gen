import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useState, useEffect } from "react";
import { BookOpen, TrendingUp, Calendar, Trophy, Clock, CheckCircle, BarChart2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import api from "@/lib/api/api";

export interface StudentData {
  pollStats: {
    total: number;
    taken: number;
    absent: number;
  };
  pollResults: {
    name: string;
    subject: string;
    score: number;
    date: string;
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
          <Card className="lg:col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white relative overflow-hidden shadow-lg dark:shadow-2xl border-0">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-8 min-h-[200px] sm:h-64">
              {/* Left: Text (50%) */}
              <div className="w-full sm:w-1/2 flex flex-col justify-center text-center sm:text-left mb-4 sm:mb-0">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 drop-shadow-sm">
                  Welcome Back! <span className="capitalize">{user?.firstName || 'Student'}</span>
                </h2>
                <p className="mb-4 text-base sm:text-lg font-semibold opacity-90 drop-shadow-sm">
                  Your Study, Your Say—Live!
                </p>
                <Button
                  className="bg-white/95 hover:bg-white text-blue-600 font-bold shadow-md w-fit transition-all duration-200 hover:scale-105 mx-auto sm:mx-0"
                  onClick={() => {
                    navigate({ to: '/student/pollroom' });
                  }}
                  data-tour="join-room-btn"
                >
                  Join Poll Room
                </Button>
              </div>
              {/* Right: Image placeholder */}
              <div className="w-full sm:w-1/2 flex items-center justify-center">
                <div className="w-32 h-32 sm:w-48 sm:h-48 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm relative overflow-hidden">
                  <BarChart2 className="w-16 h-16 sm:w-24 sm:h-24 text-white/80" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Poll Stats Summary */}
          <Card className="flex flex-col justify-between p-4 sm:p-6 shadow-lg dark:shadow-2xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" data-tour="poll-stats">
            <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-sm sm:text-base">Total Polls</span>
                </div>
                <span className="font-bold text-lg text-blue-600">{pollStats?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                  <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm sm:text-base">Polls Taken</span>
                </div>
                <span className="text-blue-600 font-bold text-lg">{pollStats?.taken || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-red-500 dark:text-red-400" />
                  <span className="font-semibold text-gray-700 dark:text-gray-300 text-sm sm:text-base">Polls Absent</span>
                </div>
                <span className="text-blue-600 font-bold text-lg">{pollStats?.absent || 0}</span>
              </div>
            </CardContent>
          </Card>
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
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-blue-50 dark:bg-slate-700/50 border border-blue-100 dark:border-slate-600 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex flex-col mb-2 sm:mb-0">
                      <div className="font-semibold text-blue-800 dark:text-blue-300 text-sm sm:text-base">{poll.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Date: {new Date(poll.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-blue-700 dark:text-blue-400 font-bold">{poll.score}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        Timer: {pollDetails[idx]?.timer || 'N/A'}{"s"}
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
                  className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/40 border border-green-100 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-800 transition-colors cursor-pointer"
                  onClick={() => navigate({ to: `/student/pollroom/${localActiveRoom}` })}
                >
                  <div>
                    <div className="font-semibold text-green-800 dark:text-green-300 text-sm sm:text-base">Room {localActiveRoom}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Click to rejoin</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs text-green-600 dark:text-green-400">Active</span>
                  </div>
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
                      className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors cursor-pointer"
                      onClick={() => navigate({ to: `/student/pollroom/${room.roomCode}` })}
                    >
                      <div className="font-semibold text-blue-800 dark:text-blue-300 text-sm sm:text-base truncate">{room.roomName}</div>
                      <div className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">Active</div>
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
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-700"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-blue-800 dark:text-blue-300 text-sm sm:text-base truncate">{poll.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{poll.time}</div>
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
                roomWiseScores.map((room, idx) => (
                  <div key={room.roomCode || idx} className="p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-300 text-sm sm:text-base truncate">{room.roomName}</h3>
                      <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {room.averageScore || room.avgScore || '0'}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Polls Taken:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 ml-2">
                          {room.taken || room.attendedPolls || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Polls:</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 ml-2">{room.totalPolls || 0}</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Progress:</span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${room.totalPolls > 0 ? ((room.taken || room.attendedPolls || 0) / room.totalPolls) * 100 : 0}%`
                            }}
                          />
                        </div>
                        <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                          {room.totalPolls > 0 ? Math.round(((room.taken || room.attendedPolls || 0) / room.totalPolls) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-sm font-semibold text-green-800 dark:text-green-300">Average Score</div>
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {performanceSummary?.avgScore || '0'}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">
                  {parseFloat(performanceSummary?.avgScore || '0') > 14 ? '+' : ''}
                  {(parseFloat(performanceSummary?.avgScore || '0') - 12).toFixed(1)} from baseline
                </div>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-semibold text-blue-800 dark:text-blue-300">Participation Rate</div>
                <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {performanceSummary?.participationRate || '0%'}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {pollStats?.taken || 0} out of {pollStats?.total || 0} polls
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}