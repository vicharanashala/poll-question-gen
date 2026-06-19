import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle, Circle, Clock, Eye, EyeOff, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '@/lib/api/api';
import { useAuth } from '@/lib/hooks/use-auth';

type PollAnswer = {
  userId: string;
  answerIndex: number;
  answeredAt: string;
};

type Poll = {
  _id: string;
  question: string;
  options: string[];
  correctOptionIndex?: number;
  timer: number;
  createdAt: string;
  answers?: PollAnswer[];
};

type Room = {
  roomCode: string;
  name: string;
  teacherName: string;
  teacherId: string;
  status: 'active' | 'ended';
  polls: Poll[];
};

const getTimeLeft = (poll: Poll): number => {
  const duration = typeof poll.timer === 'number' && poll.timer > 0 ? poll.timer : 30;
  const createdAtMs = poll.createdAt ? new Date(poll.createdAt).getTime() : Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
  return Math.max(0, duration - elapsed);
};

const getPollTiming = (poll: Poll): { phase: 'upcoming' | 'active' | 'ended'; startMs: number; endMs: number; timeLeft: number } => {
  const now = Date.now();
  const duration = typeof poll.timer === 'number' && poll.timer > 0 ? poll.timer : 30;
  const startMs = poll.createdAt ? new Date(poll.createdAt).getTime() : now;
  const endMs = startMs + duration * 1000;

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

export default function StudentPollDetails() {
  const { code, pollId, mode } = useParams({ strict: false }) as {
    code: string;
    pollId: string;
    mode: string;
  };
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userAnswer = useMemo(() => {
    if (!poll || !user?.uid) return undefined;
    return poll.answers?.find((answer) => answer.userId === user.uid);
  }, [poll, user?.uid]);

  const isAttemptedMode = mode === 'attempted';
  const pollTiming = poll ? getPollTiming(poll) : null;
  const canAnswer = !!poll && !!room && !!pollTiming && pollTiming.phase === 'active' && room.status === 'active' && timeLeft > 0 && !userAnswer && (mode === 'active' || mode === 'latest');
  const shouldRevealCorrect = !!userAnswer || isAttemptedMode;

  useEffect(() => {
    const loadPoll = async () => {
      try {
        const res = await api.get(`/livequizzes/rooms/${code}`);
        const loadedRoom: Room | null = res.data?.room || null;
        if (!loadedRoom) {
          toast.error('Room not found');
          navigate({ to: '/student/pollroom' });
          return;
        }

        const loadedPoll = loadedRoom.polls?.find((entry) => entry._id === pollId);
        if (!loadedPoll) {
          toast.error('Poll not found');
          navigate({ to: `/student/pollroom/${code}` });
          return;
        }

        setRoom(loadedRoom);
        setPoll(loadedPoll);
        setSelectedOption(null);
        setTimeLeft(getTimeLeft(loadedPoll));
      } catch {
        toast.error('Failed to load poll details');
      }
    };

    loadPoll();
  }, [code, pollId, navigate]);

  useEffect(() => {
    if (!poll) return;

    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(poll));
    }, 1000);

    return () => clearInterval(interval);
  }, [poll]);

  const submitAnswer = async () => {
    if (!poll || selectedOption === null || selectedOption === undefined || !user?.uid) {
      toast.warning('Please select an option first');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/livequizzes/rooms/${code}/polls/answer`, {
        pollId: poll._id,
        userId: user.uid,
        answerIndex: selectedOption,
      });

      toast.success('Answer submitted successfully');
      navigate({ to: `/student/pollroom/${code}` });
    } catch {
      toast.error('Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!room || !poll) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">Loading poll details...</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
      <Button
        variant="outline"
        onClick={() => navigate({ to: `/student/pollroom/${code}` })}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Poll Room
      </Button>

      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{poll.question}</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Room: {room.name} ({room.roomCode})
              </p>
            </div>

            <div className="text-sm font-medium flex items-center gap-2">
              {pollTiming?.phase === 'active' ? (
                <>
                  <Clock className="w-4 h-4" />
                  {timeLeft}s
                </>
              ) : pollTiming?.phase === 'upcoming' ? (
                <>
                  <Clock className="w-4 h-4" />
                  Starts at {formatDateTime(pollTiming.startMs)}
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Start: {pollTiming ? formatDateTime(pollTiming.startMs) : '-'} | End: {pollTiming ? formatDateTime(pollTiming.endMs) : '-'}
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {poll.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isUserAnswer = userAnswer?.answerIndex === index;
            const isCorrect = shouldRevealCorrect && index === poll.correctOptionIndex;

            return (
              <button
                key={index}
                type="button"
                disabled={!canAnswer}
                onClick={() => canAnswer && setSelectedOption(index)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${canAnswer
                  ? isSelected
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-violet-400'
                  : isCorrect
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : isUserAnswer
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
              >
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : isSelected || isUserAnswer ? (
                    <Circle className="w-4 h-4 text-violet-500 fill-violet-500/20" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-400" />
                  )}
                  <span>{option}</span>
                  {isCorrect && (
                    <span className="ml-auto text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Correct
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              {canAnswer ? (
                <>
                  <Trophy className="w-4 h-4" />
                  Select an option and submit your answer
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  This poll is view-only for your current context
                </>
              )}
            </div>

            {canAnswer && (
              <Button
                onClick={submitAnswer}
                disabled={isSubmitting || selectedOption === null || selectedOption === undefined}
                className="bg-gradient-to-r from-emerald-500 to-blue-500 text-white"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
