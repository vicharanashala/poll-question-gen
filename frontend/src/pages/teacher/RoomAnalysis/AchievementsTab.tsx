import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import api from "@/lib/api/api";
import { LoadingState } from "./States";

type Props = {
  roomId: string;
};

type AchievementData = {
  badges: { name: string; description: string; earned: number }[];
  students: { name: string; earnedBadges: string[] }[];
};

export const AchievementsTab = ({ roomId }: Props) => {
  const [achievements, setAchievements] = useState<AchievementData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/livequizzes/rooms/${roomId}/analysis/achievements`);
        const result = response.data;
        if (result.success) {
          setAchievements(result.data.achievements || result.data);
        }
      } catch (err) {
        console.error("Error fetching achievements:", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (roomId) fetchAchievements();
  }, [roomId]);

  if (isLoading && !achievements) {
    return <LoadingState message="Loading achievements..." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Achievement Distribution</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Read-only view of badges awarded based on session rules.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {achievements?.badges?.map((ach, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden group transition-colors">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white dark:bg-slate-800 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform" />
              <div className="w-14 h-14 mx-auto bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mb-3 relative z-10 border border-slate-100 dark:border-slate-700">
                <Award className="text-yellow-500 w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white">{ach.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 h-8">{ach.description}</p>
              <div className="inline-block bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-700">
                {ach.earned} Earned
              </div>
            </div>
          ))}
          {(!achievements?.badges || achievements.badges.length === 0) && (
            <div className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              No badges awarded yet.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <h3 className="text-md font-bold text-slate-800 dark:text-white mb-4">Recent Awards</h3>
        <div className="space-y-3">
          {achievements?.students?.slice(0, 5).map((student, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
              <span className="font-medium text-slate-700 dark:text-slate-200">{student.name}</span>
              <div className="flex gap-2 flex-wrap">
                {student.earnedBadges.map((b) => (
                  <span key={b} className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                    <Award size={12} /> {b}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {(!achievements?.students || achievements.students.filter((s) => s.earnedBadges.length > 0).length === 0) && (
            <div className="text-sm text-slate-500 dark:text-slate-400">No recent awards in this room.</div>
          )}
        </div>
      </div>
    </div>
  );
};
