import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useState, useEffect } from "react";
import { ClipboardList, Users, TrendingUp, HelpCircle, BarChart2, Loader2, ExternalLink, Award, Zap, Trophy, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import api from "@/lib/api/api";

export interface TeacherData {
  summary: {
    totalAssessmentRooms: number;
    totalPolls: number;
    totalResponses: number;
    totalPossibleResponses?: number;
    totalPointsDistributed: number;
    participationRate: string;
  };
  activeRooms: RoomPreview[];
  recentRooms: RoomPreview[];
  scoringInsights: {
    totalPointsDistributed: number;
    avgPointsPerStudent: number;
    highestScore: number;
    lowestScore: number;
  };
  achievements: {
    badgesEarned: BadgeInfo[];
    totalBadgesEarned: number;
  };
  faqs: FAQ[];
}

export interface RoomPreview {
  roomName: string;
  roomCode: string;
  totalPolls?: number;
  totalResponses?: number;
  totalStudents?: number;
  status?: 'active' | 'ended';
  createdAt: string;
}

export interface BadgeInfo {
  name: string;
  icon: string;
  description: string;
  studentCount: number;
}

export interface FAQ {
  question: string;
  answer: string;
}

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const [isDark] = useState(false);
  const [dashboardData, setDashboardData] = useState<TeacherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const teacherId = user?.uid;
      if (!teacherId) {
        throw new Error('No teacher ID found');
      }

      const response = await api.get(`/teachers/dashboard/${teacherId}`);
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600">{error}</p>
            <Button
              onClick={fetchDashboardData}
              className="mt-4 bg-red-600 hover:bg-red-700"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const stats: TeacherData["summary"] = dashboardData?.summary ?? {
    totalAssessmentRooms: 0,
    totalPolls: 0,
    totalResponses: 0,
    totalPointsDistributed: 0,
    participationRate: '0%'
  };
  const activeRooms = dashboardData?.activeRooms || [];
  const recentRooms = dashboardData?.recentRooms || [];
  const faqs = dashboardData?.faqs || [];
  const scoringInsights = dashboardData?.scoringInsights ?? {
    totalPointsDistributed: 0,
    avgPointsPerStudent: 0,
    highestScore: 0,
    lowestScore: 0,
  };
  const achievements = dashboardData?.achievements ?? {
    badgesEarned: [],
    totalBadgesEarned: 0,
  };

  // Calculate participation rate for pie chart
  const participationData = [
    { name: "Responses", value: stats.totalResponses || 0 },
    { name: "No Response", value: Math.max(0, (stats.totalPossibleResponses || 0) - (stats.totalResponses || 0)) }
  ];

  // Bar chart data for recent rooms
  const roomsBarData = recentRooms
    .sort((b, a) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 4)
    .reverse()
    .map(room => ({
      name: room.roomName?.substring(0, 10) + (room.roomName?.length > 10 ? '...' : ''),
      polls: room.totalPolls || 0,
      responses: room.totalResponses || 0
    }));

  // Combine active and recent rooms
  const combinedRooms = [
    ...activeRooms.map(room => ({ ...room, status: 'active' as const })),
    ...recentRooms.filter(room => room.status !== 'active')
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="w-full">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">WELCOME BACK</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Overview of your teaching analytics and assessments
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base w-full sm:w-auto"
          onClick={() => {
            navigate({ to: '/teacher/pollroom' });
          }}
          data-tour="create-room-btn"
        >
          Create New Room
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8" data-tour="stats-cards">
        {/* Welcome Card */}
        <Card className="lg:col-span-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <CardContent className="flex flex-col lg:flex-row items-center justify-between p-4 sm:p-6 lg:p-8">
            <div className="lg:w-1/2 mb-4 lg:mb-0 text-center lg:text-left">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Welcome Back, Educator</h2>
              <p className="mb-4 opacity-90 text-sm sm:text-base">
                Track, analyze, and enhance student learning outcomes
              </p>
            </div>
            <div className="lg:w-1/2 flex justify-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 bg-white/20 rounded-full flex items-center justify-center">
                <ClipboardList className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 text-white/80" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="font-medium text-sm sm:text-base">Total Rooms</span>
              </div>
              <span className="font-bold text-base sm:text-lg text-blue-600">{stats.totalAssessmentRooms || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="font-medium text-sm sm:text-base">Total Polls</span>
              </div>
              <span className="font-bold text-base sm:text-lg text-blue-600">{stats.totalPolls || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="font-medium text-sm sm:text-base">Total Responses</span>
              </div>
              <span className="font-bold text-base sm:text-lg text-blue-600">{stats.totalResponses || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="font-medium text-sm sm:text-base">Participation Rate</span>
              </div>
              <span className="font-bold text-base sm:text-lg text-blue-600">{stats.participationRate || '0%'}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                <span className="font-medium text-sm sm:text-base">Points Distributed</span>
              </div>
              <span className="font-bold text-base sm:text-lg text-amber-500">{stats.totalPointsDistributed || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scoring Insights & Achievements Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Points & Scoring Visibility */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
              Scoring Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-blue-50 dark:bg-slate-700 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{scoringInsights.avgPointsPerStudent}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avg Points/Student</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-slate-700 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{scoringInsights.highestScore}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Highest Score</div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-slate-700 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-500">{scoringInsights.lowestScore}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lowest Score</div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-slate-700 rounded-lg text-center">
                <div className="text-2xl font-bold text-amber-500">{scoringInsights.totalPointsDistributed}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Distributed</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold">Scoring Method:</span> Time-based scoring. Points = maxPoints × (1 - responseTime/timer). Faster responses earn more points. Incorrect answers get 0 points.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Achievements Monitoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              <Award className="h-4 w-4 sm:h-5 sm:w-5" />
              Achievements Overview
              {achievements.totalBadgesEarned > 0 && (
                <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {achievements.totalBadgesEarned} earned
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {achievements.badgesEarned.length > 0 ? (
              <div className="space-y-3">
                {achievements.badgesEarned.slice(0, 5).map((badge, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-slate-700 dark:to-slate-700 rounded-lg border border-amber-100 dark:border-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{badge.icon || '🏅'}</span>
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-white">{badge.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{badge.description}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-amber-600">{badge.studentCount}</div>
                      <div className="text-xs text-gray-500">students</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Award className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No badges earned yet across your rooms</p>
                <p className="text-xs mt-1 text-gray-400">Badges are earned by students based on performance</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Room Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8" data-tour="rooms-section">
        {/* Combined Rooms Section */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
              My Rooms
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 hover:text-blue-700 text-sm w-full sm:w-auto"
              onClick={() => {
                navigate({ to: '/teacher/manage-rooms' });
              }}
            >
              View All <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {combinedRooms.slice(0, 3).map((room, idx) => (
              <div key={idx} className={`p-3 sm:p-4 rounded-lg border transition-all hover:shadow-md ${room.status === 'active'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-blue-50 dark:bg-slate-700 border-blue-100 dark:border-slate-600'
                }`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{room.roomName}</div>
                      {room.status === 'active' && (
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2">
                      Code: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs">{room.roomCode}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Created: {formatDate(room.createdAt)}
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xs sm:text-sm text-green-600 dark:text-green-400 font-medium">
                          {room.totalPolls || 0}
                        </span>
                        <span className="text-xs text-gray-500">polls</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-medium">
                          {room.totalResponses || 0}
                        </span>
                        <span className="text-xs text-gray-500">responses</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${room.status === 'active'
                        ? 'text-green-600 border-green-200 dark:text-green-400'
                        : 'text-gray-500 border-gray-200'
                        }`}
                    >
                      {room.status === 'active' ? 'Active' : 'Ended'}
                    </Badge>
                    {room.status === 'active' && (
                      <Button size="sm" variant="outline" className="text-xs"
                        onClick={() => {
                          navigate({ to: `/teacher/pollroom/${room.roomCode}` });
                        }}
                      >
                        Go to Room
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {combinedRooms.length === 0 && (
              <div className="text-center text-gray-500 py-6 sm:py-8">
                <ClipboardList className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
                <p className="text-base sm:text-lg mb-2">No rooms created yet</p>
                <p className="text-xs sm:text-sm">Create your first room to start engaging with students</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              <ArrowUpDown className="h-4 w-4 sm:h-5 sm:w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                navigate({ to: '/teacher/manage-rooms' });
              }}
            >
              Generate Reports
            </Button>
            <div className="pt-3 sm:pt-4 border-t">
              <div className="text-center space-y-2">
                <div className="text-xs sm:text-sm text-gray-500">Room Statistics</div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <div className="text-base sm:text-lg font-bold text-blue-600">{stats.totalAssessmentRooms || 0}</div>
                    <div className="text-xs text-gray-500">Total</div>
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-bold text-green-600">{activeRooms.length}</div>
                    <div className="text-xs text-gray-500">Active</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8" data-tour="analytics">
        {/* Participation Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              Response Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                <PieChart>
                  <Pie
                    data={participationData}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    className="sm:outerRadius={80}"
                    fill="#8884d8"
                    label
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 sm:gap-6 mt-3 sm:mt-4">
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-gray-500">Responses</div>
                  <div className="text-lg sm:text-xl font-bold text-blue-600">
                    {stats.totalResponses || 0}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-gray-500">Total Polls</div>
                  <div className="text-lg sm:text-xl font-bold text-green-600">
                    {stats.totalPolls || 0}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-gray-500">Rate</div>
                  <div className="text-lg sm:text-xl font-bold text-orange-600">
                    {stats.participationRate || '0%'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Room Poll and Response Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              Recent Room Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
              <BarChart data={roomsBarData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                  className="sm:text-xs"
                />
                <YAxis
                  tick={{ fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                  className="sm:text-xs"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#374151' : '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Bar
                  dataKey="polls"
                  fill="#3b82f6"
                  radius={[2, 2, 0, 0]}
                  name="Polls"
                />
                <Bar
                  dataKey="responses"
                  fill="#10b981"
                  radius={[2, 2, 0, 0]}
                  name="Responses"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="text-center mt-2 text-xs sm:text-sm text-gray-500">
              ← Older rooms &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Latest rooms →
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 sm:p-4 bg-blue-50 dark:bg-slate-700 rounded-lg">
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                You have created {stats.totalAssessmentRooms || 0} assessment rooms with a total of {stats.totalPolls || 0} polls.
                Your polls have received {stats.totalResponses || 0} responses with a participation rate of {stats.participationRate || '0%'}.
                A total of <span className="font-semibold text-amber-600">{stats.totalPointsDistributed || 0} points</span> have been distributed to students.
                {scoringInsights.avgPointsPerStudent > 0 &&
                  ` Students averaged ${scoringInsights.avgPointsPerStudent} points, with a high of ${scoringInsights.highestScore} and low of ${scoringInsights.lowestScore}.`
                }
                {activeRooms.length > 0 ?
                  ` You currently have ${activeRooms.length} active room${activeRooms.length > 1 ? 's' : ''}.` :
                  ' Create a new room to start engaging with students.'
                }
                {achievements.totalBadgesEarned > 0 &&
                  ` ${achievements.totalBadgesEarned} badges have been earned by students across your rooms.`
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FAQs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200 text-base sm:text-lg">
              <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              Educator Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-3 sm:p-4 bg-blue-50 dark:bg-slate-700 rounded-lg border border-blue-100 dark:border-slate-600">
                <div className="font-semibold text-blue-700 dark:text-blue-300 mb-2 text-sm sm:text-base">
                  {faq.question}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {faq.answer}
                </div>
              </div>
            ))}
            {faqs.length === 0 && (
              <div className="text-center text-gray-500 py-3 sm:py-4 text-sm sm:text-base">
                No FAQs available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
