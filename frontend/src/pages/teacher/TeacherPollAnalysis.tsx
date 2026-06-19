import { useRef, useState, useEffect, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Clock4, Users, Crown, Medal, Search, Loader2, ArrowUpDown, AlertTriangle, TrendingDown, Zap, Info } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import api from "@/lib/api/api";
import { Badge } from "@/components/ui/badge";

interface Participant {
  name: string;
  score: number;
  correct: number;
  wrong: number;
  questionsAttempted: number;
  accuracy: number;
  timeTaken: string;
  avgResponseTime: string;
  avgResponseTimeSec: number;
}

interface Question {
  text: string;
  options: string[];
  correctOptionIndex: number;
  maxPoints: number;
  timer: number;
  totalResponses: number;
  correctCount: number;
  correctPercentage: number;
  avgAnswerTimeSec: number;
  responseRate: number;
  isLowEngagement: boolean;
  isHighDifficulty: boolean;
}

interface ScoringInsights {
  totalPointsDistributed: number;
  avgPointsPerStudent: number;
  highestScore: number;
  lowestScore: number;
  scoringMethod: string;
}

interface AnalysisData {
  id: string;
  name: string;
  createdAt: string;
  duration: string;
  totalStudents: number;
  participationRate: number;
  participants: Participant[];
  questions: Question[];
  scoringInsights: ScoringInsights;
}

const scoreRanges = [
  { label: "90–100%", min: 90, max: 100, color: "#10b981" },
  { label: "70–89%", min: 70, max: 89, color: "#6366f1" },
  { label: "50–69%", min: 50, max: 69, color: "#f59e0b" },
  { label: "Below 50%", min: 0, max: 49, color: "#ef4444" },
];

type SortField = 'name' | 'score' | 'accuracy' | 'avgResponseTimeSec' | 'questionsAttempted';
type SortDirection = 'asc' | 'desc';

export default function TeacherPollAnalysis() {
  const ref = useRef<HTMLDivElement>(null);
  const { roomId } = useParams({ from: "/teacher/manage-rooms/pollanalysis/$roomId" });

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/livequizzes/rooms/${roomId}/analysis`);
        const result = response.data;

        if (result.success) {
          setAnalysisData(result.data);
        } else {
          throw new Error('Failed to get analysis data');
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        }
        console.error('Error fetching analysis data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      fetchAnalysisData();
    }
  }, [roomId]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedParticipants = useMemo(() => {
    if (!analysisData) return [];
    const filtered = analysisData.participants.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else {
        cmp = (a[sortField] ?? 0) - (b[sortField] ?? 0);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [analysisData, search, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-2 text-lg">Loading analysis data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 text-lg">No analysis data available</p>
      </div>
    );
  }

  const participants = analysisData.participants;
  const top3 = [...participants].sort((a, b) => b.score - a.score).slice(0, 3);

  const totalCorrect = participants.reduce((s, p) => s + p.correct, 0);
  const totalWrong = participants.reduce((s, p) => s + p.wrong, 0);
  const pieData = [
    { name: "Correct", value: totalCorrect, color: "#34d399" },
    { name: "Wrong", value: totalWrong, color: "#f87171" },
  ];

  // Score distribution based on accuracy percentages
  const scoreRangeData = scoreRanges.map((range) => ({
    name: range.label,
    count: participants.filter((p) => p.accuracy >= range.min && p.accuracy <= range.max).length,
    color: range.color,
  }));

  const downloadExcel = () => {
    const data = [...participants].sort((a, b) => b.score - a.score).map((p, index) => ({
      Rank: index + 1,
      Name: p.name,
      Score: p.score,
      QuestionsAttempted: p.questionsAttempted,
      Correct: p.correct,
      Wrong: p.wrong,
      "Accuracy %": p.accuracy,
      "Avg Response Time": p.avgResponseTime,
      "Total Time": p.timeTaken,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analysis");
    const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
    saveAs(blob, `${analysisData.name}-analysis.xlsx`);
  };

  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-xs font-semibold hover:text-purple-500 transition ${sortField === field ? 'text-purple-600' : 'text-purple-700 dark:text-purple-300'}`}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-40'}`} />
    </button>
  );

  return (
    <div
      className="p-6 space-y-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
      ref={ref}
    >
      {/* Room Details */}
      <Card className="shadow-lg border border-purple-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-2xl text-purple-600 dark:text-purple-300">Room: {analysisData.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-8 flex-wrap text-gray-800 dark:text-gray-200">
          <div className="flex gap-2 items-center"><Calendar /> {formatDate(analysisData.createdAt)}</div>
          <div className="flex gap-2 items-center"><Clock4 /> Duration: {analysisData.duration}</div>
          <div className="flex gap-2 items-center"><Users /> Participants: {participants.length} / {analysisData.totalStudents}</div>
          <div className="flex gap-2 items-center">
            <Zap className="text-amber-500" />
            Participation: {analysisData.participationRate}%
          </div>
        </CardContent>
      </Card>

      {/* Scoring Insights */}
      <Card className="shadow border border-amber-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Zap className="h-5 w-5" />
            Points & Scoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-amber-50 dark:bg-slate-700 rounded-lg text-center">
              <div className="text-2xl font-bold text-amber-600">{analysisData.scoringInsights.totalPointsDistributed}</div>
              <div className="text-xs text-gray-500 mt-1">Total Points</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-slate-700 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{analysisData.scoringInsights.avgPointsPerStudent}</div>
              <div className="text-xs text-gray-500 mt-1">Avg/Student</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-slate-700 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{analysisData.scoringInsights.highestScore}</div>
              <div className="text-xs text-gray-500 mt-1">Highest</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-slate-700 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-500">{analysisData.scoringInsights.lowestScore}</div>
              <div className="text-xs text-gray-500 mt-1">Lowest</div>
            </div>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg flex items-start gap-2">
            <Info className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-gray-600 dark:text-gray-400">{analysisData.scoringInsights.scoringMethod}</p>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <div className="grid md:grid-cols-3 gap-4">
        {top3.map((p, i) => {
          const Icon = i === 0 ? Crown : Medal;
          const badge = ["🥇", "🥈", "🥉"][i];
          const bgLight = ["bg-yellow-100", "bg-yellow-200", "bg-yellow-50"];
          const bgDark = ["dark:bg-yellow-900", "dark:bg-yellow-800", "dark:bg-yellow-700"];
          return (
            <Card
              key={p.name}
              className={`
          shadow-lg dark:shadow-yellow-800 border border-yellow-300 
          ${bgLight[i]} ${bgDark[i]} 
          text-gray-800 dark:text-yellow-100
        `}
            >
              <CardHeader className="flex gap-2 items-center">
                <Icon className="text-yellow-500" />
                <CardTitle className="text-yellow-700 dark:text-yellow-300">{badge} {p.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Score: <span className="font-bold">{p.score} pts</span></p>
                <p>Accuracy: <span className="font-bold">{p.accuracy}%</span> ({p.correct}/{p.correct + p.wrong})</p>
                <p>Avg Response: <span className="font-bold">{p.avgResponseTime}</span></p>
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Participant List — Sortable */}
      <Card className="shadow border border-indigo-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-indigo-700 dark:text-indigo-300">Student Performance</CardTitle>
          <div className="mt-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="p-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm bg-white dark:bg-slate-700 dark:text-white"
            />
          </div>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto divide-y rounded scrollbar-thin scrollbar-thumb-purple-500">
          {/* Table Header with Sort Controls */}
          <div className="grid grid-cols-7 p-2 border-b bg-purple-50 dark:bg-slate-700 rounded-t sticky top-0 z-10">
            <SortButton field="name" label="Name" />
            <SortButton field="score" label="Score" />
            <SortButton field="questionsAttempted" label="Attempted" />
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Correct</span>
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Wrong</span>
            <SortButton field="accuracy" label="Accuracy" />
            <SortButton field="avgResponseTimeSec" label="Avg Time" />
          </div>
          {sortedParticipants.map((p, i) => {
            const rank = [...analysisData.participants].sort((a, b) => b.score - a.score).findIndex(x => x.name === p.name);
            const rankEmoji = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "";
            return (
              <div
                key={i}
                className={`grid grid-cols-7 items-center p-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition ${rank === 0 ? "bg-yellow-50 dark:bg-yellow-900/20" : rank === 1 ? "bg-slate-50 dark:bg-slate-800" : rank === 2 ? "bg-orange-50 dark:bg-orange-900/20" : ""
                  }`}
              >
                <span>{rankEmoji} {p.name}</span>
                <span className="font-bold">{p.score}</span>
                <span>{p.questionsAttempted}</span>
                <span className="text-green-600">{p.correct}</span>
                <span className="text-red-500">{p.wrong}</span>
                <span>{p.accuracy}%</span>
                <span>{p.avgResponseTime}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pie Chart */}
      <Card className="shadow border border-purple-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-green-600 dark:text-green-400">Overall Answer Accuracy</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <PieChart width={300} height={300}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
              label
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </CardContent>
      </Card>

      {/* Score Distribution */}
      <Card className="shadow border border-green-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-emerald-700 dark:text-emerald-400">Accuracy Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scoreRangeData.map((r, i) => (
            <div key={i} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
              <span className="w-24">{r.name}</span>
              <div className="h-3 w-1/2 bg-gray-200 rounded">
                <div
                  className="h-3 rounded"
                  style={{ width: `${participants.length > 0 ? (r.count / participants.length) * 100 : 0}%`, backgroundColor: r.color }}
                />
              </div>
              <span className="w-12 text-right">{r.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Question-Level Analysis — Enhanced */}
      <Card className="shadow border border-pink-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-pink-700 dark:text-pink-300">Question-Level Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analysisData.questions.map((q, i) => (
            <div key={i} className="p-3 border rounded-lg dark:border-slate-600">
              {/* Question header with indicators */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Q{i + 1}: {q.text}
                  </span>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  {q.isLowEngagement && (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-900/20">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Low Engagement
                    </Badge>
                  )}
                  {q.isHighDifficulty && (
                    <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      High Difficulty
                    </Badge>
                  )}
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 text-xs">
                <div className="bg-blue-50 dark:bg-slate-700 rounded p-1.5 text-center">
                  <div className="font-bold text-blue-600">{q.totalResponses}</div>
                  <div className="text-gray-500">Responses</div>
                </div>
                <div className="bg-green-50 dark:bg-slate-700 rounded p-1.5 text-center">
                  <div className="font-bold text-green-600">{q.correctPercentage}%</div>
                  <div className="text-gray-500">Correct</div>
                </div>
                <div className="bg-purple-50 dark:bg-slate-700 rounded p-1.5 text-center">
                  <div className="font-bold text-purple-600">{q.avgAnswerTimeSec}s</div>
                  <div className="text-gray-500">Avg Time</div>
                </div>
                <div className="bg-amber-50 dark:bg-slate-700 rounded p-1.5 text-center">
                  <div className="font-bold text-amber-600">{q.maxPoints} pts</div>
                  <div className="text-gray-500">Max Points</div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-700 rounded p-1.5 text-center">
                  <div className="font-bold text-gray-600">{q.responseRate}%</div>
                  <div className="text-gray-500">Response Rate</div>
                </div>
              </div>

              {/* Correct answer progress bar */}
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 bg-gray-200 rounded overflow-hidden">
                  <div
                    className={`h-2 rounded ${q.isHighDifficulty ? 'bg-red-400' : 'bg-pink-500'}`}
                    style={{ width: `${q.correctPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{q.correctCount}/{q.totalResponses} correct</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Download Button */}
      <div className="text-center mt-4">
        <button
          onClick={downloadExcel}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition"
        >
          Download as Excel
        </button>
      </div>
    </div>
  );
}