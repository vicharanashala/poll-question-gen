import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/store/auth-store";
import { useNavigate } from "@tanstack/react-router";
import api from "@/lib/api/api";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";

export default function CohostJoin() {
  const [roomCode, setRoomCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || !inviteCode) {
      toast.error("Please enter both Room Code and Invite Code");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/livequizzes/rooms/cohost", {
        roomCode: roomCode.trim().toUpperCase(),
        inviteCode: inviteCode.trim().toUpperCase(),
        userId: user?.uid
      });

      if (response.data.success) {
        toast.success("Joined room as cohost!");
        navigate({ to: `/teacher/pollroom/${response.data.roomId}` });
      } else {
        toast.error(response.data.message || "Failed to join room");
      }
    } catch (err: any) {
      console.error("Error joining as cohost:", err);
      toast.error(err.response?.data?.message || "Failed to join room. Check your codes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <Card className="w-full max-w-md shadow-xl border-purple-100 dark:border-purple-900/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Join as Cohost
          </CardTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Enter the codes provided by the host to assist in the live session.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Room Code
              </label>
              <Input
                placeholder="e.g. ROOM-123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="uppercase font-mono"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Invite Code
              </label>
              <Input
                placeholder="6-character code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="uppercase font-mono"
                maxLength={6}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining Session...
                </>
              ) : (
                "Join Session"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => navigate({ to: "/teacher/home" })}
            >
              Back to Dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
