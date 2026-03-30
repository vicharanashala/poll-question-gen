import { Activity, AlertCircle, Award, BarChart2, Clock, Shield, Target, TrendingDown, TrendingUp, Users } from "lucide-react";
import { DashboardData } from "@/shared/types";
import { BarChart, LineChart } from "./Charts";
import { LineChartPoint } from "@/shared/types";

type Props = {
  analysisData: DashboardData | null;
  engagementData: LineChartPoint[];
  engagementSummary: { average: number; lowestPoint: LineChartPoint } | null;
  scoreDistribution: Array<{ label: string; value: number }>;
  insightData: {
    lowestAccuracyQuestion: DashboardData["questions"][number] | null;
    highestEngagementQuestion: DashboardData["questions"][number] | null;
    averageResponseTimeSeconds: number;
    speedBadgeEarned: number;
    averageQuestionAccuracy: number;
  };
};

export const OverviewTab = ({
  analysisData,
  engagementData,
  engagementSummary,
  scoreDistribution,
  insightData,
}: Props) => (
  <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="flex-1 min-w-[250px] max-w-[400px] bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Students</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{analysisData?.overview.totalStudents}</h3>
        </div>
        <div className="w-12 h-12 shrink-0 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 ml-3">
          <Users size={24} />
        </div>
      </div>

      <div className="flex-1 min-w-[250px] max-w-[400px] bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Cohosts</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{analysisData?.overview.totalCohosts ?? 0}</h3>
        </div>
        <div className="w-12 h-12 shrink-0 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 ml-3">
          <Shield size={24} />
        </div>
      </div>

      <div className="flex-1 min-w-[250px] max-w-[400px] bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Questions Asked</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{analysisData?.overview.questionsAsked ?? 0}</h3>
        </div>
        <div className="w-12 h-12 flex-shrink-0 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 ml-3">
          <BarChart2 size={24} />
        </div>
      </div>

      <div className="flex-1 min-w-[250px] max-w-[400px] bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Avg. Accuracy</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{analysisData?.overview?.avgAccuracy ?? 0}%</h3>
        </div>
        <div className="w-12 h-12 flex-shrink-0 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 ml-3">
          <Target size={24} />
        </div>
      </div>

      <div className="flex-1 min-w-[250px] max-w-[400px] bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-colors">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Points Distributed</p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{analysisData?.overview?.pointsDistributed ?? 0}</h3>
        </div>
        <div className="w-12 h-12 flex-shrink-0 bg-amber-50 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 ml-3">
          <Award size={24} />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col transition-colors">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <Activity size={20} className="text-blue-500 dark:text-blue-400" />
          Session Engagement
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Participation rate by question based on how many students submitted a response.</p>
        <div className="flex-1 min-h-[160px]">
          <LineChart data={engagementData} />
        </div>
        {engagementSummary && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-400">Average engagement</p>
              <p className="font-bold text-slate-800 dark:text-white">{engagementSummary.average}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-400">Lowest participation</p>
              <p className="font-bold text-slate-800 dark:text-white">{engagementSummary.lowestPoint.label}: {engagementSummary.lowestPoint.value}%</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col transition-colors">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
          <BarChart2 size={20} className="text-indigo-500 dark:text-indigo-400" />
          Score Distribution
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Number of students within point brackets.</p>
        <div className="flex-1 min-h-[160px]">
          <BarChart data={scoreDistribution} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors lg:col-span-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <AlertCircle size={20} className="text-amber-500 dark:text-amber-400" />
          Session Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-2">
              <TrendingDown size={18} /> Accuracy Summary
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {insightData.lowestAccuracyQuestion
                ? `Average question accuracy was ${insightData.averageQuestionAccuracy}%, with the lowest-performing question at ${Math.round(insightData.lowestAccuracyQuestion.correctPct)}%.`
                : "Accuracy summary will appear once responses are available."}
            </p>
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold mb-2">
              <TrendingUp size={18} /> Participation Summary
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {insightData.highestEngagementQuestion
                ? `Average engagement was ${engagementSummary?.average ?? 0}%, and the highest-response question reached ${Math.round(insightData.highestEngagementQuestion.engagementPct)}% participation.`
                : "Participation summary will appear once students start answering questions."}
            </p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold mb-2">
              <Clock size={18} /> Response Summary
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {analysisData?.students?.length
                ? `Students took about ${insightData.averageResponseTimeSeconds}s on average per submitted answer.${insightData.speedBadgeEarned ? ` ${insightData.speedBadgeEarned} speed badges were awarded.` : ""}`
                : "Response summary will appear once students have submitted answers."}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
