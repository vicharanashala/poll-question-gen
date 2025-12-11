import { useState } from "react";
import { useNavigate } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Users, ClipboardList, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import api from "@/lib/api/api"

/*
const AuroraText = ({
  children,
  colors = ["#A07CFE", "#FE8FB5", "#FFBE7B"],
}: {
  children: React.ReactNode;
  colors?: string[];
}) => (
  <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent animate-pulse dark:from-purple-400 dark:via-blue-400 dark:to-cyan-400">
    {children}
  </span>
);
*/

export default function CreatePollRoom() {
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const createRoom = async () => {
    if (!roomName.trim()) {
      toast.error("Please enter an assessment name");
      return;
    }

    if (!user?.uid) {
      toast.error("Authentication required to create assessments");
      return;
    }

    setIsCreating(true);
    try {
      const res = await api.post("/livequizzes/rooms/", {
        name: roomName,
        teacherId: user.uid
      });
      toast.success("Assessment space created successfully!");
      navigate({ to: `/teacher/pollroom/${res.data.roomCode}` });
    } catch (error) {
      console.error("Error creating assessment:", error);
      toast.error("Failed to create assessment space. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      createRoom();
    }
  };

  return (
    <div className="relative max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto p-3 sm:p-6">
      {/* Page Header */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="flex flex-col xs:flex-row items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="relative mb-2 xs:mb-0">
            <div className="absolute -inset-1 sm:-inset-2 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full blur opacity-20 dark:from-blue-500 dark:to-blue-700"></div>
            <div className="relative h-12 w-12 sm:h-16 sm:w-16 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full flex items-center justify-center shadow-lg dark:from-blue-500 dark:to-blue-700">
              <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-blue-900 dark:text-blue-100">
            Create Assessment Space
          </h1>
        </div>
        <p className="text-sm sm:text-lg text-slate-600 dark:text-gray-400 max-w-xs sm:max-w-md mx-auto">
          Establish a dedicated environment for interactive learning assessments
        </p>
      </div>

      {/* Configuration Card */}
      <Card className="relative overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-2xl font-bold text-slate-800 dark:text-gray-200">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-md dark:from-blue-500 dark:to-blue-700">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            Assessment Configuration
          </CardTitle>
          <p className="text-xs sm:text-base text-slate-600 dark:text-gray-400 mt-2">
            Define your assessment parameters for optimal student engagement
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 sm:p-4 border border-blue-200 dark:border-blue-800 mt-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="h-7 w-7 sm:h-8 sm:w-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center flex-shrink-0 dark:from-blue-500 dark:to-blue-700">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-xs sm:text-base text-blue-900 dark:text-blue-300 mb-1">
                  Assessment Workflow
                </h3>
                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
                  After creation, you'll receive a unique identifier for the students to join.
                  You can then administer assessments, monitor participation,
                  and analyze results in real-time through the educator's dashboard.
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-6">
          {/* Input Section */}
          <div className="space-y-2 sm:space-y-3">
            <label htmlFor="roomName" className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300">
              Assessment Title
            </label>
            <div className="relative group">
              <div className="absolute -inset-0.5 sm:-inset-1 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl blur opacity-20 group-focus-within:opacity-30 transition-opacity duration-300 dark:from-blue-500 dark:to-blue-700"></div>
              <Input
                id="roomName"
                placeholder="e.g., Algebra Midterm Review, Chemistry Lab Evaluation..."
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="relative h-10 sm:h-14 text-base sm:text-lg bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-300 placeholder:text-slate-400 dark:placeholder:text-gray-500"
                disabled={isCreating}
              />
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 mt-1">
              <Sparkles className="h-3 w-3" />
              Use a clear, descriptive title to help students identify the assessment
            </p>
          </div>

          {/* Create Button */}
          <Button
            onClick={createRoom}
            disabled={isCreating || !roomName.trim()}
            className="w-full h-10 sm:h-14 text-base sm:text-lg font-semibold bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 border-0 shadow-md transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 dark:from-blue-500 dark:to-blue-700 dark:hover:from-blue-600 dark:hover:to-blue-800"
          >
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              {isCreating ? (
                <>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-xs sm:text-base">Establishing Assessment...</span>
                </>
              ) : (
                <>
                  <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-base">Create Assessment Space</span>
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
