import { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { toast } from 'sonner';
import api from '@/lib/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clearGuestCohostSession, setGuestCohostSession } from '@/lib/guest-cohost-session';

export default function GuestCohostInvite() {
  const params = useParams({ from: '/guest-cohost-invite/$token' });
  const token: string = params.token as string;
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleAcceptInvite = async () => {
    const cleanDisplayName = displayName.trim();
    if (!cleanDisplayName) {
      toast.error('Please enter your display name');
      return;
    }

    setIsJoining(true);
    try {
      const response: any = await api.post('/livequizzes/rooms/cohost/guest/join', {
        token,
        displayName: cleanDisplayName,
      });

      const { roomId, cohostId, message } = response.data;
      clearGuestCohostSession();
      setGuestCohostSession({
        cohostId,
        displayName: cleanDisplayName,
        roomCode: roomId,
        token,
        joinedAt: Date.now(),
      });

      toast.success(message ?? 'Joined as cohost successfully');
      navigate({ to: `/teacher/pollroom/${roomId}` });
    } catch (error: any) {
      if (error.response?.data?.message === 'jwt expired') {
        toast.error('Invite link has expired.');
      } else {
        toast.error(error.response?.data?.message ?? 'Failed to join as cohost.');
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center transition-colors duration-300">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Welcome</p>

        <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-white mb-4">
          Join This Session As Cohost
        </h2>

        <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base mb-6 leading-relaxed">
          Enter your name to join this live session with temporary cohost access.
        </p>

        <div className="space-y-3">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            maxLength={80}
          />
          <Button
            onClick={handleAcceptInvite}
            className="w-full"
            disabled={isJoining}
          >
            {isJoining ? 'Joining...' : 'Accept Invitation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
