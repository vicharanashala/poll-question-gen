import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, BarChart2, AlertCircle, Loader2, Play, Eye, User } from "lucide-react"; import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api/api"; // Temporarily commented out API

interface Room {
    roomCode: string;
    name: string;
    createdAt: string;
    status: 'active' | 'ended';
    teacherId: string;
    hostName?: string;
    totalStudents?: number;
    coHosts?: any[];
    endedAt?: string;

    teacherName?: string;
    teacher?: {
        firstName: string;
        lastName: string;
    };
    polls: {
        _id: string;
        question: string;
        options: string[];
        correctOptionIndex: number;
        answers: { userId: string; answerIndex: number }[];
    }[];
}

export default function TeacherCohostedRooms() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchCohostedRooms = async () => {
            if (!user?.uid) {
                setError("Authentication required");
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                setError(null);

                // --- DUMMY DATA FOR UI TESTING ---
                // TODO: Replace this with actual API call when backend is ready

                // setTimeout(() => {
                // const dummyData: Room[] = [
                //     {
                //         roomCode: "MATH101",
                //         name: "Advanced Calculus (Co-hosted)",
                //         createdAt: new Date().toISOString(),
                //         status: 'active',
                //         teacherId: "other-teacher-1",
                //         polls: [
                //             { _id: "p1", question: "Q1", options: ["A", "B"], correctOptionIndex: 0, answers: [{userId: "u1", answerIndex: 0}, {userId: "u2", answerIndex: 1}] },
                //             { _id: "p2", question: "Q2", options: ["A", "B"], correctOptionIndex: 0, answers: [{userId: "u1", answerIndex: 0}] }
                //         ]
                //     },
                //     {
                //         roomCode: "PHY202",
                //         name: "Quantum Physics Quiz (Co-hosted)",
                //         createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
                //         status: 'ended',
                //         teacherId: "other-teacher-2",
                //         polls: [
                //             { _id: "p3", question: "Q1", options: ["A", "B", "C"], correctOptionIndex: 1, answers: [{userId: "u1", answerIndex: 1}, {userId: "u2", answerIndex: 1}, {userId: "u3", answerIndex: 0}] },
                //             { _id: "p4", question: "Q2", options: ["A", "B"], correctOptionIndex: 0, answers: [{userId: "u1", answerIndex: 0}] },
                //             { _id: "p5", question: "Q3", options: ["A", "B"], correctOptionIndex: 0, answers: [{userId: "u1", answerIndex: 0}, {userId: "u3", answerIndex: 0}] }
                //         ]
                //     }
                // ];

                const response = await api.get(`/livequizzes/rooms/cohost/${user.uid}`);

                // Simple date sort 
                const sortedRooms = response.data.rooms.sort((a: Room, b: Room) => {
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });

                setRooms(sortedRooms);
                setLoading(false);

                setRooms(sortedRooms);
                setLoading(false);
                // }, 1000); // 1 second fake delay to show loading spinner
                // console.log("🔍 Cohost API response:", response.data.rooms[0]);

            } catch (err) {
                console.error('Error fetching rooms:', err);
                setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
                setLoading(false);
            }
        };

        fetchCohostedRooms();
    }, [user?.uid]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const calculateParticipants = (room: Room) => {
        return room.totalStudents || 0;
    };

    const calculateDuration = (room: Room) => {
        const start = new Date(room.createdAt).getTime();
        const end = room.status === 'ended' && room.endedAt
            ? new Date(room.endedAt).getTime()
            : currentTime;
        const diffMs = Math.max(0, end - start);
        const diffMins = Math.ceil(diffMs / 60000);
        return `${Math.max(1, diffMins)} mins`;
    };

    const handleReturnToRoom = (roomCode: string, event: React.MouseEvent) => {
        event.stopPropagation();
        navigate({ to: `/teacher/pollroom/${roomCode}` });
    };

    const handleViewAnalysis = (roomCode: string, event: React.MouseEvent) => {
        event.stopPropagation();
        navigate({ to: `/teacher/manage-rooms/pollanalysis/${roomCode}` });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-5rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Loading co-hosted sessions...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-5rem)]">
                <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-lg text-red-600 dark:text-red-400 mb-4">{error}</p>
                <Button
                    onClick={() => window.location.reload()}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-purple-900 dark:text-purple-100">Co-hosted Rooms</h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        Rooms where you are invited as a co-host
                    </p>
                </div>
            </div>

            {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    <BarChart2 className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
                        No co-hosted sessions found
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
                        You have not joined any rooms as a co-host yet.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {rooms.map((room) => (
                        <Card
                            key={room.roomCode}
                            className={`transition-all hover:shadow-lg ${room.status === 'ended' ? 'cursor-pointer hover:border-purple-300' : ''}`}
                            onClick={() => room.status === 'ended' ? handleViewAnalysis(room.roomCode, {} as React.MouseEvent) : undefined}
                        >
                            <CardHeader className="pb-3 sm:pb-4">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-0">
                                    <CardTitle className="text-base sm:text-lg font-semibold text-purple-800 dark:text-purple-200">
                                        {room.name}
                                    </CardTitle>
                                    <Badge
                                        variant={room.status === 'active' ? 'default' : 'secondary'}
                                        className={`$${room.status === 'active'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                            }`}
                                    >
                                        {room.status === 'active' ? 'Active' : 'Completed'}
                                    </Badge>
                                </div>
                                <div className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">
                                    {formatDate(room.createdAt)}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
                                    {/* 1. Participants */}
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <Users className="h-4 w-4 text-purple-500" />
                                        <div>
                                            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Participants</p>
                                            <p className="font-medium text-xs sm:text-base">{calculateParticipants(room)}</p>
                                        </div>
                                    </div>

                                    {/* 2. Questions */}
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <BarChart2 className="h-4 w-4 text-purple-500" />
                                        <div>
                                            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Questions</p>
                                            <p className="font-medium text-xs sm:text-base">{room.polls.length}</p>
                                        </div>
                                    </div>

                                    {/* 3. Duration */}
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <Clock className="h-4 w-4 text-purple-500" />
                                        <div>
                                            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Duration</p>
                                            <p className="font-medium text-xs sm:text-base">{calculateDuration(room)}</p>
                                        </div>
                                    </div>

                                    {/* 4. Host */}
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        <User className="h-4 w-4 text-purple-500" />
                                        <div>
                                            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">Host</p>
                                            <p className="font-medium text-xs sm:text-base">
                                                {room.teacherName ||
                                                    (room.teacher?.firstName && room.teacher?.lastName
                                                        ? `${room.teacher.firstName} ${room.teacher.lastName}`.trim()
                                                        : "Host")}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {room.status === 'active' ? (
                                    <div className="flex flex-col xs:flex-row gap-2">
                                        <Button
                                            onClick={(e) => handleReturnToRoom(room.roomCode, e)}
                                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-base"
                                        >
                                            <Play className="h-4 w-4 mr-1 sm:mr-2" />
                                            Continue
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        onClick={(e) => handleViewAnalysis(room.roomCode, e)}
                                        variant="outline"
                                        className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 text-xs sm:text-base"
                                    >
                                        <Eye className="h-4 w-4 mr-1 sm:mr-2" />
                                        View Results
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}