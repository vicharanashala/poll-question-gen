import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, HelpCircle, Trophy, Activity, ChevronRight, Search, Filter, Download, Settings, CheckCircle2, Zap, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthStore } from "@/lib/store/auth-store";
import api from "@/lib/api/api";
import socket from "@/lib/api/socket";
import { toast } from 'sonner';

// --- Interfaces ---

interface DashboardSummary {
  totalAssessmentRooms: number;
  totalPolls: number;
  totalResponses: number;
  participationRate: string;
}

interface RoomPreview {
  roomName: string;
  roomCode: string;
  createdAt: string;
  status: 'active' | 'ended';
  totalPolls: number;
  totalResponses: number;
  totalStudents: number;
}

interface TeacherDashboardData {
  summary: DashboardSummary;
  activeRooms: RoomPreview[];
  recentRooms: RoomPreview[];
  responsesPerRoom: { roomName: string, totalResponses: number }[];
  faqs: { question: string, answer: string }[];
}

interface Participant {
  id: string;
  name: string;
  email: string;
  score: number;
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  timeTaken: string;
}

interface QuestionAnalytics {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  responses: number;
  correctPct: number;
  avgTime: string;
  points: number;
}

interface RoomAnalysis {
  id: string;
  roomCode: string;
  name: string;
  status: 'active' | 'ended';
  createdAt: string;
  totalStudents: number;
  totalPolls: number;
  pointsDistributed: number;
  duration: string;
  participants: Participant[];
  questions: QuestionAnalytics[];
}

// --- Components ---

const StatCard = ({ title, value, icon: Icon, description, trend, colorClass }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="overflow-hidden border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{value}</h3>
          </div>
          <div className={`p-3 rounded-2xl ${colorClass}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="flex items-center mt-4 gap-2">
          {trend !== undefined && (
            <span className={`text-xs font-medium flex items-center ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {trend >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {Math.abs(trend)}%
            </span>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500">{description}</p>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [analysisData, setAnalysisData] = useState<RoomAnalysis | null>(null);
  const [selectedRoomCode, setSelectedRoomCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Initial Data Fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (!user?.uid) return;
        const res = await api.get(`/teachers/dashboard/${user.uid}`);
        setDashboardData(res.data);

        // Auto-select first active or first recent room
        const initialRoom = res.data.activeRooms[0]?.roomCode || res.data.recentRooms[0]?.roomCode;
        if (initialRoom) {
          setSelectedRoomCode(initialRoom);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        toast.error("Failed to load dashboard summary");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [user?.uid]);

  // Fetch Detailed Analysis
  const fetchAnalysis = useCallback(async (code: string) => {
    setAnalysisLoading(true);
    try {
      const res = await api.get(`/livequizzes/rooms/${code}/analysis`);
      setAnalysisData(res.data.data || res.data); // Handle potential {success, data} wrapper
    } catch (err) {
      console.error("Error fetching analysis:", err);
      toast.error("Failed to load room analytics");
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoomCode) {
      fetchAnalysis(selectedRoomCode);

      // Socket Integration
      socket.emit('join-room', selectedRoomCode);

      const handleUpdate = () => {
        fetchAnalysis(selectedRoomCode);
      };

      socket.on('poll-results-updated', handleUpdate);
      socket.on('room-updated', handleUpdate);
      socket.on('room-ended', handleUpdate);

      return () => {
        socket.off('poll-results-updated', handleUpdate);
        socket.off('room-updated', handleUpdate);
        socket.off('room-ended', handleUpdate);
        socket.emit('leave-room', selectedRoomCode);
      };
    }
  }, [selectedRoomCode, fetchAnalysis]);

  // Real-time clock effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtered and sorted students
  const processedStudents = useMemo(() => {
    if (!analysisData) return [];
    let filtered = analysisData.participants.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a: any, b: any) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [analysisData, searchTerm, sortConfig]);

  // Pre-calculate hardest and easiest questions to avoid in-place sorting of state
  const { hardestQuestion, easiestQuestion } = useMemo(() => {
    if (!analysisData?.questions || analysisData.questions.length === 0) {
      return { hardestQuestion: null, easiestQuestion: null };
    }

    // Create a copy before sorting to avoid mutating state
    const sorted = [...analysisData.questions].sort((a, b) => a.correctPct - b.correctPct);

    return {
      hardestQuestion: sorted[0],
      easiestQuestion: sorted[sorted.length - 1]
    };
  }, [analysisData?.questions]);

  // Pre-calculate top performers for the leaderboard
  const topPerformers = useMemo(() => {
    if (!analysisData?.participants) return [];
    return [...analysisData.participants]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [analysisData?.participants]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  const summary = dashboardData?.summary;
  const recentRooms = dashboardData?.recentRooms || [];
  const activeRooms = dashboardData?.activeRooms || [];
  const allRooms = [...activeRooms, ...recentRooms.filter(r => !activeRooms.some(a => a.roomCode === r.roomCode))];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] p-4 md:p-8 space-y-8 font-sans transition-colors duration-300">

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className={`animate-pulse ${analysisData?.status === 'active' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              ● {analysisData?.status === 'active' ? 'LIVE SESSION' : 'ENDED SESSION'}
            </Badge>
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-7 px-2 text-xs font-mono">
                    ID: {selectedRoomCode || 'Select Room'} <ChevronRight className="w-3 h-3 ml-1 rotate-90" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 rounded-xl">
                  {allRooms.map((room) => (
                    <DropdownMenuItem
                      key={room.roomCode}
                      onClick={() => setSelectedRoomCode(room.roomCode)}
                      className="flex justify-between"
                    >
                      <span>{room.roomName}</span>
                      <span className="text-[10px] text-slate-400">{room.roomCode}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            {analysisData?.name || 'Teacher Dashboard'}
            <span className="text-slate-300 font-light hidden sm:block">|</span>
            <span className="text-lg font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
              {analysisData ? `Created ${new Date(analysisData.createdAt).toLocaleDateString()}` : 'Select a room to see analytics'}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col items-end px-3">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Current Time</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <div className="h-10 w-[1px] bg-slate-100 dark:bg-slate-800" />
          <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Settings className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800">
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {analysisLoading && (
        <div className="flex items-center gap-2 text-blue-600 font-medium">
          <Loader2 className="w-4 h-4 animate-spin" /> Fetching room data...
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="sticky top-4 z-10 bg-[#F8FAFC]/80 dark:bg-[#020617]/80 backdrop-blur-md py-2 -mx-4 px-4">
          <TabsList className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1 rounded-2xl shadow-sm inline-flex">
            <TabsTrigger value="overview" className="rounded-xl">Overview</TabsTrigger>
            <TabsTrigger value="students" className="rounded-xl">Students</TabsTrigger>
            <TabsTrigger value="questions" className="rounded-xl">Analytics</TabsTrigger>
          </TabsList>
        </div>

        {/* --- OVERVIEW TAB --- */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Students Enrolled"
              value={analysisData?.totalStudents || 0}
              icon={Users}
              description={`${summary?.totalAssessmentRooms || 0} rooms total`}
              colorClass="bg-blue-600"
            />
            <StatCard
              title="Room Questions"
              value={analysisData?.totalPolls || 0}
              icon={HelpCircle}
              description={`${summary?.totalPolls || 0} overall polls`}
              colorClass="bg-indigo-600"
            />
            <StatCard
              title="Points Distributed"
              value={(analysisData?.pointsDistributed || 0).toLocaleString()}
              icon={Zap}
              description="Point tally for room"
              colorClass="bg-amber-500"
            />
            <StatCard
              title="Participation Rate"
              value={analysisData?.participants.length || 0}
              icon={Activity}
              description={`Out of ${analysisData?.totalStudents || 0} students`}
              colorClass="bg-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Question Wise Success Rate Chart */}
            <Card className="lg:col-span-2 border-none shadow-lg bg-white dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">Question Wise Success Rate</CardTitle>
                <CardDescription>Accuracy percentage for each question in this session</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysisData?.questions.map((q, i) => ({ ...q, label: `Q${i + 1}` })) || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#94a3b8' }}
                      unit="%"
                      domain={[0, 100]}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f1f5f9' }}
                      formatter={(value: any) => [`${value}%`, 'Accuracy']}
                    />
                    <Bar
                      dataKey="correctPct"
                      radius={[6, 6, 0, 0]}
                      minPointSize={5} // for all wrong answers small offset
                    >
                      {analysisData?.questions.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.correctPct > 80 ? '#10b981' : entry.correctPct > 50 ? '#3b82f6' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">Leaderboard</CardTitle>
                <CardDescription>Top performers in {analysisData?.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {topPerformers.map((student, idx) => (
                    <div key={student.id} className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="w-10 h-10 ring-2 ring-white dark:ring-slate-800">
                          <AvatarFallback className={idx === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100"}>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {idx === 0 && <Trophy className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 fill-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{student.name}</p>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (student.score / ((analysisData?.totalPolls || 1) * 5 || 100)) * 100)}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className={`h-full rounded-full ${idx === 0 ? 'bg-amber-400' : 'bg-blue-500'}`}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{student.score}</p>
                        <p className="text-[10px] text-emerald-500 font-medium">{student.accuracy}% acc</p>
                      </div>
                    </div>
                  ))}
                  {!analysisData?.participants.length && (
                    <div className="text-center py-8 text-slate-400">
                      No participants yet
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-500">Overall Participation</span>
                    <span className="text-sm font-bold">{summary?.participationRate || '0%'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Educator Resources / FAQs */}
          <Card className="border-none shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100 text-lg font-bold">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                Educator Resources
              </CardTitle>
              <CardDescription>Common questions and platform guidance for instructors</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(dashboardData?.faqs || []).map((faq, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all group">
                    <div className="font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                      {faq.question}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 pl-3.5 border-l border-slate-200 dark:border-slate-800">
                      {faq.answer}
                    </div>
                  </div>
                ))}
              </div>
              {(!dashboardData?.faqs || dashboardData.faqs.length === 0) && (
                <div className="text-center text-slate-400 py-10">
                  <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>No educator resources available at the moment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- STUDENTS TAB --- */}
        <TabsContent value="students" className="space-y-6">
          <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold">Student Breakdown</CardTitle>
                <CardDescription>Metrics for students in {analysisData?.name}</CardDescription>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or email..."
                    className="pl-10 h-10 border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" className="rounded-xl border-slate-200 dark:border-slate-800">
                  <Filter className="w-4 h-4 mr-2" /> Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent">
                      <TableHead className="font-bold py-4">Student</TableHead>
                      <TableHead className="font-bold cursor-pointer" onClick={() => handleSort('attempted')}>Attempted</TableHead>
                      <TableHead className="font-bold cursor-pointer" onClick={() => handleSort('accuracy')}>Accuracy</TableHead>
                      <TableHead className="font-bold cursor-pointer" onClick={() => handleSort('score')}>Score</TableHead>
                      <TableHead className="font-bold cursor-pointer" onClick={() => handleSort('timeTaken')}>Total Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {processedStudents.map((student) => {
                        return (
                          <motion.tr
                            key={student.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-800">
                                  <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{student.name}</p>
                                  <p className="text-xs text-slate-400">{student.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{student.attempted} / {analysisData?.totalPolls}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${student.accuracy > 80 ? 'bg-emerald-500' : student.accuracy > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                    style={{ width: `${student.accuracy}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold w-10">{student.accuracy}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                                {student.score} pts
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-slate-500 dark:text-slate-400">
                              {student.timeTaken}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                      {!processedStudents.length && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                            No students found matching your criteria.
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- QUESTIONS ANALYTICS TAB --- */}
        <TabsContent value="questions" className="space-y-6">
          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                <div className="p-3 bg-white/20 rounded-full mb-3">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Hardest Q</h3>
                <p className="text-sm text-indigo-100 mt-2 truncate w-full px-2">
                  {hardestQuestion?.text || 'N/A'}
                </p>
                <p className="text-xs text-indigo-200 mt-1">Accuracy: {hardestQuestion?.correctPct || 0}%</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                <div className="p-3 bg-white/20 rounded-full mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Easiest Q</h3>
                <p className="text-sm text-emerald-100 mt-2 truncate w-full px-2">
                  {easiestQuestion?.text || 'N/A'}
                </p>
                <p className="text-xs text-emerald-200 mt-1">Accuracy: {easiestQuestion?.correctPct || 0}%</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-lg bg-white dark:bg-slate-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold">Individual Question Metrics</CardTitle>
                <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-none">{analysisData?.totalPolls} Questions Total</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
                  {analysisData?.questions.map((q, idx) => (
                    <div key={q.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all bg-slate-50/30 dark:bg-slate-950/30">
                      <div className="flex flex-col lg:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">Q{idx + 1}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${q.difficulty === 'High' ? 'bg-rose-50 text-rose-500' :
                              q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
                              }`}>
                              {q.difficulty} DIFFICULTY
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 text-lg mb-1">{q.text}</h4>
                          <p className="text-sm text-slate-500">Type: {q.type} • Points: {q.points}</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:gap-8">
                          <div className="text-center sm:text-left">
                            <p className="text-xs text-slate-400 font-medium">RESPONSES</p>
                            <p className="text-lg font-bold">{q.responses}</p>
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-xs text-slate-400 font-medium">CORRECT</p>
                            <div className="flex items-center justify-center sm:justify-start gap-1">
                              <span className={`text-lg font-bold ${q.correctPct > 80 ? 'text-emerald-500' : q.correctPct > 50 ? 'text-amber-500' : 'text-rose-500'}`}>{q.correctPct}%</span>
                            </div>
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-xs text-slate-400 font-medium">AVG. TIME</p>
                            <p className="text-lg font-bold">{q.avgTime}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!analysisData?.questions.length && (
                    <div className="text-center py-20 text-slate-400">
                      <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No questions have been asked in this room yet.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Info */}
      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-sm text-slate-400">© 2026 Admin Dashboard • Session Monitor v2.4.1</p>
        <div className="flex gap-6">
          <button className="text-sm text-slate-400 hover:text-blue-600 transition-colors">Help Center</button>
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">System Online</span>
          </div>
        </div>
      </div>

<<<<<<< Updated upstream
=======
  const stats: TeacherData["summary"] = dashboardData?.summary ?? {
    totalAssessmentRooms: 0,
    totalPolls: 0,
    totalResponses: 0,
    participationRate: '0%'
  };
  const activeRooms = dashboardData?.activeRooms || [];
  const recentRooms = dashboardData?.recentRooms || [];
  const faqs = dashboardData?.faqs || [];

  // Calculate participation rate for pie chart
  const participationData = [
    { name: "Responses", value: stats.totalResponses || 0 },
    { name: "No Response", value: Math.max(0, (stats.totalPolls || 0) - (stats.totalResponses || 0)) }
  ];

  // Enhanced bar chart data for recent rooms with both polls and responses
  // Sort by date (newest first) and then reverse to show latest on the right
  const roomsBarData = recentRooms
    .sort((b, a) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 4)
    .reverse()
    .map(room => ({
      name: room.roomName?.substring(0, 10) + (room.roomName?.length > 10 ? '...' : ''),
      polls: room.totalPolls || 0,
      responses: room.totalResponses || 0
    }));

  // Combine active and recent rooms, with active rooms marked
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

  /* const getStatusColor = (status: 'active' | 'ended' | undefined): string => {
     switch (status) {
       case 'active':
         return 'bg-green-500';
       case 'ended':
         return 'bg-red-500';
       default:
         return 'bg-gray-500';
     }
   };*/

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
              {/* <Button
                variant="secondary"
                className="bg-white text-blue-800 hover:bg-white/90 text-sm sm:text-base"
              >
                Quick Start Guide
              </Button> */}
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
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            {/* <Button
              variant="outline"
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                navigate({ to: '/teacher/pollroom' });
              }}
            >
              Create New Room
            </Button> */}
            <Button
              variant="outline"
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                navigate({ to: '/teacher/manage-rooms' });
              }}
            >
              Generate Reports
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                navigate({ to: '/teacher/join-cohost' });
              }}
            >
              <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Join as Cohost
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
                {activeRooms.length > 0 ?
                  ` You currently have ${activeRooms.length} active room${activeRooms.length > 1 ? 's' : ''}.` :
                  ' Create a new room to start engaging with students.'
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
>>>>>>> Stashed changes
    </div>
  );
}
