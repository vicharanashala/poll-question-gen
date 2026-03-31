import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import Confetti from "react-confetti";
import { Zap, Users, Info, History, LogOut, Clock, CheckCircle, Circle, Trophy, X, AlertCircle, BookOpen, ChevronDown, ChevronUp, ArrowLeft, ShieldCheck, Award, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import api from "@/lib/api/api";
import socket from "@/lib/api/socket";
import { useAuthStore } from "@/lib/store/auth-store";
import type { UserAchievement } from "@/shared/types";
import { getBadgeTier } from "@/shared/getBadgeTier";

//const Socket_URL = import.meta.env.VITE_SOCKET_URL;
//const socket = io(Socket_URL);
type PollAnswer = {
  userId: string;
  answerIndex: number;
  answeredAt: string;
};

type Poll = {
  _id: string;
  question: string;
  options: string[];
  roomCode: string;
  creatorId: string;
  createdAt: string;
  timer: number;
  correctOptionIndex?: number;
  answers?: PollAnswer[];
};

type PollPhase = 'upcoming' | 'active' | 'ended';

type Room = {
  roomCode: string;
  name: string;
  teacherId: string;
  teacherName: string;
  createdAt: string;
  status: 'active' | 'ended';
  polls: Poll[];
};

type RoomDetails = {
  roomCode: string;
  creatorId: string;
  teacherName?: string;
  createdAt: string;
  room?: Room;
};

const getActivePollSnapshot = (polls: Poll[], code: string, teacherId: string): {
  activePolls: Poll[];
  timers: Record<string, number>;
} => {
  const now = Date.now();
  const timers: Record<string, number> = {};

  const activePolls = polls
    .map((poll) => {
      const baseTimer = typeof poll.timer === 'number' && poll.timer > 0 ? poll.timer : 30;
      const createdAtMs = poll.createdAt ? new Date(poll.createdAt).getTime() : now;
      const elapsedSeconds = Math.max(0, Math.floor((now - createdAtMs) / 1000));
      const remaining = Math.max(0, baseTimer - elapsedSeconds);

      timers[poll._id] = remaining;

      return {
        ...poll,
        roomCode: poll.roomCode || code,
        creatorId: poll.creatorId || teacherId,
        timer: baseTimer,
      };
    })
    .filter((poll) => timers[poll._id] > 0);

  return { activePolls, timers };
};



export default function StudentPollRoom() {
  const params = useParams({ from: '/student/pollroom/$code' });
  const roomCode = params.code;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [joinedRoom, setJoinedRoom] = useState(false);
  const [livePolls, setLivePolls] = useState<Poll[]>([]);
  const [roomDetails, setRoomDetails] = useState<RoomDetails | null>(null);
  const [allRoomPolls, setAllRoomPolls] = useState<Poll[]>([]);
  const [answeredPolls, setAnsweredPolls] = useState<Record<string, number>>({});
  const [activeMenu, setActiveMenu] = useState<"room" | "history" | null>(null);
  const [pollTimers, setPollTimers] = useState<Record<string, number>>({});
  const [showAllPolls, setShowAllPolls] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [newBadgePopup, setNewBadgePopup] = useState<UserAchievement | null>(null);
  const [badgePopupQueue, setBadgePopupQueue] = useState<UserAchievement[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const email = useAuthStore((state) => state.user?.email)
  const answeredStorageKey = `answeredPolls_${roomCode}_${user?.uid || 'anonymous'}`;
  const hostDisplayLabel = `${roomDetails?.room?.teacherName?.trim() || roomDetails?.teacherName?.trim() || 'Host'} (Host)`;
  useEffect(() => {
  socket.on("room-data", (room) => {
    setRoomDetails(room);
  });

  socket.on("room-updated", (room) => {
    setRoomDetails(room); // update students list in real-time
  });

  return () => {
    socket.off("room-data");
    socket.off("room-updated");
  };
}, []);
  useEffect(() => {
    if (!roomCode) return;
    const joinRoom = () => {
      socket.emit('join-room', {roomCode, email});
      setJoinedRoom(true);
      toast.success("Joined room!");
    };

    const setupEventListeners = () => {
      socket.off('new-poll');
      socket.off('room-ended');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('live-poll-results');  
      socket.off('badge-earned');

      socket.on("new-poll", (poll: Poll) => {
        setLivePolls(prev => [...prev, poll]);
        toast("New poll received!");
      });

      socket.on('room-ended', () => {
        toast.error('Room has ended');
        navigate({ to: '/student/home' });
      });
      socket.on('live-poll-results',()=>{
        loadRoomDetails(roomCode)   
      })

      socket.on('badge-earned', (data: { userId: string; badges?: UserAchievement[] }) => {
        if (data?.userId !== user?.uid) return;
        const unlocked = data.badges || [];
        setBadgePopupQueue((prev) => [...prev, ...unlocked]);
      });

      socket.on('connect', () => {
        console.log('Socket reconnected, rejoining room...');
        joinRoom();
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setJoinedRoom(false);
      });
    };

    setupEventListeners();

    if (socket.connected) {
      joinRoom();
    }

    loadRoomDetails(roomCode);
    const savedAnswers = localStorage.getItem(answeredStorageKey);
    if (savedAnswers) setAnsweredPolls(JSON.parse(savedAnswers));
    localStorage.setItem("activeRoomCode", roomCode);
    localStorage.setItem("joinedRoom", "true");

    return () => {
      socket.off('new-poll');
      socket.off('room-ended');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('live-poll-results');  
      socket.off('badge-earned');
    };
  }, [roomCode, navigate, user?.uid, answeredStorageKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPollTimers(prev => {
        const updated: Record<string, number> = {};
        livePolls.forEach(p => {
          const current = prev[p._id] ?? p.timer;
          updated[p._id] = current > 0 ? current - 1 : 0;
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [livePolls]);

  useEffect(() => {
    Object.entries(pollTimers).forEach(([pollId, time]) => {
      if (time === 0) {
        setLivePolls(prev => prev.filter(p => p._id !== pollId));
      }
    });
  }, [pollTimers]);

  useEffect(() => {
    if (roomCode) {
      localStorage.setItem(answeredStorageKey, JSON.stringify(answeredPolls));
    }
  }, [answeredPolls, roomCode, answeredStorageKey]);

  useEffect(() => {

  socket.on("removed-from-room", (roomCode) => {

    toast.error("You were removed by the teacher");

    cleanupRoom();

    navigate({ to: "/student/home" });

  });

  return () => {
    socket.off("removed-from-room");
  };

}, []);

  const loadRoomDetails = async (code: string) => {
    try {
      const res = await api.get(`/livequizzes/rooms/${code}`);
      if (res.data?.room) {
        setRoomDetails(res.data);
        const roomPolls: Poll[] = res.data.room.polls || [];
        setAllRoomPolls(roomPolls);

        const { activePolls, timers } = getActivePollSnapshot(
          roomPolls,
          code,
          res.data.room.teacherId
        );

        setLivePolls(activePolls);
        setPollTimers(timers);
      }
    } catch (e) {
      console.error("Failed to load room details:", e);
    }
  };

  const hasUserAnsweredPoll = useCallback((poll: Poll) => {
    if (!user?.uid) return false;
    if (answeredPolls[poll._id] !== undefined) return true;
    return !!poll.answers?.some((answer) => answer.userId === user.uid);
  }, [answeredPolls, user?.uid]);


  useEffect(() => {
    if (newBadgePopup || badgePopupQueue.length === 0) return;
    setNewBadgePopup(badgePopupQueue[0]);
    setBadgePopupQueue((prev) => prev.slice(1));
  }, [badgePopupQueue, newBadgePopup]);

  useEffect(() => {
    if (!newBadgePopup) return;
    setShowConfetti(true);
    toast.success(`Badge earned: ${newBadgePopup.badgeId?.name || "Achievement unlocked"}`);
    const popupTimeout = setTimeout(() => setNewBadgePopup(null), 4000);
    const confettiTimeout = setTimeout(() => setShowConfetti(false), 2500);
    return () => {
      clearTimeout(popupTimeout);
      clearTimeout(confettiTimeout);
    };
  }, [newBadgePopup]);

  const cleanupRoom = () => {

  setJoinedRoom(false);
  setLivePolls([]);
  setAnsweredPolls({});
  setRoomDetails(null);
  setAllRoomPolls([]);
  setActiveMenu(null);

  localStorage.removeItem("activeRoomCode");
  localStorage.removeItem("joinedRoom");

};
  const exitRoom = () => {
    socket.emit("leave-room", roomCode, email);
    cleanupRoom()
    toast.info("Left the room.");
    navigate({ to: `/student/pollroom` });
  };

  const getTimerColor = (timeLeft: number) => {
    if (timeLeft > 20) return "text-emerald-500";
    if (timeLeft > 10) return "text-amber-500";
    return "text-red-500";
  };

  const getTimerBg = (timeLeft: number) => {
    if (timeLeft > 20) return "bg-emerald-500/20";
    if (timeLeft > 10) return "bg-amber-500/20";
    return "bg-red-500/20";
  };

  const getPollTiming = (poll: Poll): { phase: PollPhase; startMs: number; endMs: number; timeLeft: number } => {
    const now = Date.now();
    const startMs = poll.createdAt ? new Date(poll.createdAt).getTime() : now;
    const durationSec = typeof poll.timer === 'number' && poll.timer > 0 ? poll.timer : 30;
    const endMs = startMs + durationSec * 1000;

    if (now < startMs) {
      return { phase: 'upcoming', startMs, endMs, timeLeft: Math.ceil((startMs - now) / 1000) };
    }

    if (now < endMs) {
      return { phase: 'active', startMs, endMs, timeLeft: Math.ceil((endMs - now) / 1000) };
    }

    return { phase: 'ended', startMs, endMs, timeLeft: 0 };
  };

  const formatDateTime = (ms: number) =>
    new Date(ms).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const getPollAnswerStatus = (poll: Poll) => {
    if (!user?.uid) return 'unanswered';

    const userAnswer = answeredPolls[poll._id];
    if (userAnswer === undefined) {
      // Check if user answered in the room's poll answers
      const pollAnswer = poll.answers?.find(answer => answer.userId === user.uid);
      if (pollAnswer) {
        return pollAnswer.answerIndex === poll.correctOptionIndex ? 'correct' : 'incorrect';
      }
      return 'unanswered';
    }

    return userAnswer === poll.correctOptionIndex ? 'correct' : 'incorrect';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'correct':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Correct</span>
          </div>
        );
      case 'incorrect':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full">
            <X className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Incorrect</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
            <AlertCircle className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Not Answered</span>
          </div>
        );
    }
  };

  const sortedRoomPolls = [...allRoomPolls].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  const activeLivePolls = sortedRoomPolls.filter((p) => {
    const timing = getPollTiming(p);
    return timing.phase === 'active' && !hasUserAnsweredPoll(p);
  });
  const activePollIds = new Set(activeLivePolls.map(p => p._id));
  const attemptedPolls = sortedRoomPolls.filter(p => hasUserAnsweredPoll(p));
  const endedPolls = sortedRoomPolls.filter((p) => getPollTiming(p).phase === 'ended');
  const latestPolls = sortedRoomPolls.filter((p) => !hasUserAnsweredPoll(p));
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const endedPollGroups: Record<'Today' | 'Yesterday' | 'Older', Array<{ poll: Poll; timing: ReturnType<typeof getPollTiming> }>> = {
    Today: [],
    Yesterday: [],
    Older: [],
  };

  endedPolls.forEach((poll) => {
    const timing = getPollTiming(poll);
    const endDayStart = new Date(new Date(timing.endMs).getFullYear(), new Date(timing.endMs).getMonth(), new Date(timing.endMs).getDate()).getTime();

    if (endDayStart === startOfToday) {
      endedPollGroups.Today.push({ poll, timing });
      return;
    }

    if (endDayStart === startOfYesterday) {
      endedPollGroups.Yesterday.push({ poll, timing });
      return;
    }

    endedPollGroups.Older.push({ poll, timing });
  });

  const historyGroupOrder: Array<'Today' | 'Yesterday' | 'Older'> = ['Today', 'Yesterday', 'Older'];
  const popupTier = newBadgePopup ? getBadgeTier(newBadgePopup.badgeId?.category, newBadgePopup.badgeId?.name) : null;

  if (!roomCode) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-violet-900/20 dark:to-purple-900/20">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <Confetti recycle={false} numberOfPieces={260} />
        </div>
      )}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {newBadgePopup && (
          <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-right duration-500">
            <div
              className={`w-[320px] rounded-2xl border shadow-2xl p-4 bg-gradient-to-br ${popupTier?.bg} ${popupTier?.border}`}
            >
              <div className="flex items-start gap-3">
                <div className={`relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br ${popupTier?.iconContainer}`}>
                  {(() => {
                    const PopupIcon = popupTier?.Icon || Award;
                    return <PopupIcon className={`w-6 h-6 ${popupTier?.iconColor || "text-white"}`} />;
                  })()}
                  <div className="absolute -top-1 -right-1 bg-white p-1 rounded-full shadow-sm border border-gray-100">
                    <Sparkles className="w-3 h-3 text-yellow-500" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
                    Achievement Unlocked
                  </p>
                  <p className={`text-base font-extrabold mt-0.5 ${popupTier?.text}`}>
                    {newBadgePopup.badgeId?.name || "Achievement unlocked"}
                  </p>
                  <p className={`text-xs mt-1 ${popupTier?.categoryText}`}>
                    {newBadgePopup.badgeId?.description || "Keep it up! You earned a new badge."}
                  </p>
                  <div className="mt-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-white/60 border border-current/10 ${popupTier?.categoryText}`}>
                      {newBadgePopup.badgeId?.category || "general"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate({ to: '/student/home' })}
                title="Back to Home"
                className="mr-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-linear-to-r from-purple-500/10 to-pink-500/10 rounded-full border border-purple-200/50 dark:border-purple-700/50">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                Live Poll Session
              </span>
              </div>
            </div>

            {/* {joinedRoom && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 hover:from-blue-600 hover:to-purple-600 transition-all duration-300 hover:scale-105"
                  >
                    <Menu className="w-5 h-5 mr-2" />
                    Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => setActiveMenu(activeMenu === "room" ? null : "room")}
                    className="flex items-center gap-3 p-3 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    <Info className="w-4 h-4 text-purple-600" />
                    Room Info
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )} */}

            {joinedRoom && (
              <Button
                onClick={exitRoom}
                variant="outline"
                size="lg"
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 hover:from-red-600 hover:to-pink-600 transition-all duration-300 hover:scale-105"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Leave Room
              </Button>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Room: {roomCode}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {roomDetails?.room?.name || "Join the conversation and make your voice heard!"}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-300 mt-1 font-medium">
              {hostDisplayLabel}
            </p>
          </div>
        </div>

        <div className="relative flex justify-end mb-3">
          <Button
            id="room-details-button"
            size="lg"
            variant="outline"
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
            onClick={() => setShowRoomDetails(prev => !prev)}
          >
            Room Details
          </Button>

          {showRoomDetails && roomDetails?.room && (
            <div
              id="room-details-popover"
              className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 z-20 animate-fade-in"
              style={{ top: '100%' }}
            >
              {/* Small triangle pointer */}
              <div className="absolute -top-2 right-4 w-3 h-3 bg-white dark:bg-gray-800 rotate-45 border-l border-t border-gray-200 dark:border-gray-700"></div>

              <h3 className="text-lg font-semibold mb-2">Room Details</h3>
              <p><strong>Code:</strong> {roomDetails.room.roomCode}</p>
              <p><strong>Host:</strong> {hostDisplayLabel}</p>
              <p>
                <strong>Created:</strong>{" "}
                {roomDetails.room.createdAt
                  ? new Date(roomDetails.room.createdAt).toLocaleString()
                  : "N/A"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span className={roomDetails.room.status === 'active'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'}>
                  {roomDetails.room.status.charAt(0).toUpperCase() + roomDetails.room.status.slice(1)}
                </span>
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-8">
          <div className="flex-1 space-y-8">
            {/* Active Live Polls */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-0 shadow-2xl shadow-purple-500/10">
              <CardHeader className="pb-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl text-gray-800 dark:text-gray-100">
                        Active Polls
                      </CardTitle>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {activeLivePolls.length} poll{activeLivePolls.length !== 1 ? 's' : ''} available to answer
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {activeLivePolls.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full flex items-center justify-center">
                      <Clock className="w-12 h-12 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Waiting for new polls...
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Stay tuned! New polls will appear here automatically.
                    </p>
                  </div>
                ) : (
                  activeLivePolls.map((poll) => (
                    <div
                      key={poll._id}
                      className="group relative p-6 bg-gradient-to-r from-white to-purple-50/50 dark:from-gray-800 dark:to-purple-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-700/50 hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer"
                      onClick={() => navigate({ to: `/student/pollroom/${roomCode}/poll/${poll._id}/active` })}
                    >
                      <div className="absolute top-0 left-0 right-0 h-2 bg-gray-200 dark:bg-gray-700 rounded-t-2xl overflow-hidden">
                        <div
                          className={`h-full ${getTimerBg(pollTimers[poll._id] ?? poll.timer)} transition-all duration-1000`}
                          style={{
                            width: `${((pollTimers[poll._id] ?? poll.timer) / poll.timer) * 100}%`
                          }}
                        />
                      </div>

                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 pr-4">
                          {poll.question}
                        </h3>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getTimerBg(pollTimers[poll._id] ?? poll.timer)}`}>
                          <Clock className={`w-4 h-4 ${getTimerColor(pollTimers[poll._id] ?? poll.timer)}`} />
                          <span className={`text-sm font-medium ${getTimerColor(pollTimers[poll._id] ?? poll.timer)}`}>
                            {pollTimers[poll._id] ?? poll.timer}s
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {poll.options.length} options
                        </span>
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:from-emerald-600 hover:to-blue-600"
                        >
                          Open Poll
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent Live Polls */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-0 shadow-2xl shadow-emerald-500/10">
              <CardHeader className="pb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-xl">
                    <History className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-gray-800 dark:text-gray-100">
                      Latest Polls
                    </CardTitle>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {latestPolls.length} recent poll{latestPolls.length !== 1 ? 's' : ''} (active + non-active)
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {latestPolls.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                      <History className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      No latest polls yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Recently created polls will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {latestPolls.map((poll) => (
                      (() => {
                        const timing = getPollTiming(poll);
                        const detailMode = timing.phase === 'active' ? 'active' : 'latest';
                        const actionLabel = timing.phase === 'active' ? 'Answer Poll' : 'View Poll';

                        return (
                          <div
                            key={poll._id}
                            className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200/50 dark:border-blue-700/50 cursor-pointer hover:shadow-lg transition-all"
                            onClick={() => navigate({ to: `/student/pollroom/${roomCode}/poll/${poll._id}/${detailMode}` })}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                  {poll.question}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {poll.options.length} options
                                  {timing.phase === 'active' && ` • Active now (${timing.timeLeft}s left)`}
                                  {timing.phase === 'upcoming' && ` • Starts at ${formatDateTime(timing.startMs)}`}
                                  {timing.phase === 'ended' && ` • Start: ${formatDateTime(timing.startMs)} • End: ${formatDateTime(timing.endMs)}`}
                                </p>
                              </div>
                              <Button size="sm" variant={timing.phase === 'active' ? 'default' : 'outline'}>
                                {actionLabel}
                              </Button>
                            </div>
                          </div>
                        );
                      })()
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All Polls History */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-0 shadow-2xl shadow-blue-500/10">
              <CardHeader className="pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-xl text-gray-800 dark:text-gray-100">
                    All Polls History ({endedPolls.length})
                  </CardTitle>
                </div>

                <Button
                  onClick={() => setShowAllPolls(!showAllPolls)}
                  variant="ghost"
                  size="icon"
                  className="text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full"
                >
                  {showAllPolls ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </Button>
              </CardHeader>

              {showAllPolls && (
                <CardContent className="max-h-96 overflow-y-auto">
                  {endedPolls.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No ended polls yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {historyGroupOrder.map((group) => {
                        const items = endedPollGroups[group];
                        if (items.length === 0) return null;

                        return (
                          <div key={group} className="space-y-3">
                            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                              {group}
                            </div>

                            {items.map(({ poll, timing }) => {
                              const historyMode = hasUserAnsweredPoll(poll) ? 'attempted' : 'latest';

                              return (
                                <div
                                  key={poll._id}
                                  className="p-4 bg-gradient-to-r from-gray-50 to-blue-50/50 dark:from-gray-800 dark:to-blue-900/10 rounded-lg border border-gray-200/50 dark:border-gray-700/50 cursor-pointer hover:shadow-lg transition-all"
                                  onClick={() => navigate({ to: `/student/pollroom/${roomCode}/poll/${poll._id}/${historyMode}` })}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-medium text-gray-800 dark:text-gray-200 text-sm leading-5 pr-2">
                                      {poll.question}
                                    </h4>
                                    {getStatusBadge(getPollAnswerStatus(poll))}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {poll.options.length} options • Start: {formatDateTime(timing.startMs)} • End: {formatDateTime(timing.endMs)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          {/* Side Panel */}
          {activeMenu && (
            <div className="w-80 animate-in slide-in-from-right duration-300">
              {activeMenu === "room" && (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-0 shadow-2xl shadow-purple-500/10">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                        <Info className="w-5 h-5 text-white" />
                      </div>
                      <CardTitle className="text-xl text-gray-800 dark:text-gray-100">
                        Room Details
                      </CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {roomDetails && (
                      <div className="space-y-4">
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Code:</span>
                              <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                                {roomDetails.room?.roomCode}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Host:</span>
                              <span className="font-semibold text-purple-600 dark:text-purple-400">
                                {hostDisplayLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Created:</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {roomDetails.room?.createdAt
                                  ? new Date(roomDetails.room.createdAt).toLocaleString()
                                  : "N/A"}
                              </span>
                            </div>
                            {roomDetails.room && (
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                                <span className={`text-sm font-medium ${roomDetails.room.status === 'active'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                                  }`}>
                                  {roomDetails.room.status.charAt(0).toUpperCase() + roomDetails.room.status.slice(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
