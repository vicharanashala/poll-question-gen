import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, ArrowRightCircle, Search } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import api from "@/lib/api/api";
import { StudentData } from "./StudentDashboard";

export default function StudentSessions() {
    const { user } = useAuthStore();
    const [dashboardData, setDashboardData] = useState<StudentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const studentId = user?.uid;
            if (!studentId) throw new Error('No student ID found');
            const response = await api.get(`/students/dashboard/${studentId}`);
            setDashboardData(response.data);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };



    useEffect(() => {
        if (user?.uid) {
            fetchDashboardData();
        }
    }, [user?.uid]);

    const filteredRooms = dashboardData?.roomWiseScores
        ? dashboardData.roomWiseScores
            .filter(room =>
                room.roomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                room.roomCode.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        : [];

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium animate-pulse">Loading session history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate({ to: '/student/home' })}
                            className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                                <BookOpen className="w-8 h-8 text-indigo-500" />
                                Session History
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">Explore all your past quiz attempts and analytics</p>
                        </div>
                    </div>

                    <div className="relative group max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by room name or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm">
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Sessions</p>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{dashboardData?.roomWiseScores.length || 0}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    {/* Add more summary stats if needed */}
                </div>

                {/* Sessions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRooms.length > 0 ? (
                        filteredRooms.map((room, idx) => (
                            <Card key={room.roomCode || idx} className="border-0 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all group overflow-hidden bg-white dark:bg-slate-800">
                                <div className={`h-1.5 w-full ${room.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0">
                                            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">{room.roomName}</CardTitle>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {room.roomCode}</p>
                                                <span className="text-[10px] font-bold text-slate-400">•</span>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(room.createdAt).toLocaleDateString()}</p>
                                            </div>
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
                                            className="w-full rounded-xl border-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 font-bold text-xs"
                                            onClick={() => navigate({ to: `/student/pollroom/${room.roomCode}` })}
                                        >
                                            Rejoin <ArrowRightCircle className="ml-2 w-4 h-4" />
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-full py-20 bg-white/50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center">
                            <BookOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No sessions found</h3>
                            <p className="text-slate-400 font-medium">Try adjusting your search or join a new room to get started!</p>
                            <Button
                                onClick={() => navigate({ to: '/student/pollroom' })}
                                className="mt-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                            >
                                Join a New Room
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
