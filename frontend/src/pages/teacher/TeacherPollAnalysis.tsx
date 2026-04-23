import { useRef, useState, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Calendar, Clock4, Users, Crown, Medal, Search, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import api from "@/lib/api/api";

interface Participant {
  name: string;
  score: number;
  correct: number;
  wrong: number;
  timeTaken: string;
  userId?: string;
}

interface Question {
  text: string;
  correctCount: number;
}

interface ConfusionData {
  studentId: string;
  clicks: number;
}

interface AnalysisData {
  id: string;
  name: string;
  createdAt: string;
  duration: string;
  participants: Participant[];
  questions: Question[];
}

const scoreRanges = [
  { label: "90–100", min: 90, max: 100, color: "#10b981" },
  { label: "80–89", min: 80, max: 89, color: "#6366f1" },
  { label: "70–79", min: 70, max: 79, color: "#f59e0b" },
  { label: "60–69", min: 60, max: 69, color: "#ef4444" },
];

export default function TeacherPollAnalysis() {
  const ref = useRef<HTMLDivElement>(null);
  const { roomId } = useParams({ from: "/teacher/manage-rooms/pollanalysis/$roomId" });

  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confusionData, setConfusionData] = useState<ConfusionData[]>([]);
  const [isLoadingConfusion, setIsLoadingConfusion] = useState(true);

  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        // Note: Update this URL to match your backend base URL
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

  useEffect(() => {
    const fetchConfusionAnalytics = async () => {
      try {
        setIsLoadingConfusion(true);
        const response = await api.get(`/livequizzes/rooms/${roomId}/confusion-analytics`);
        setConfusionData(response.data || []);
      } catch (error) {
        console.error("Failed to fetch confusion data:", error);
      } finally {
        setIsLoadingConfusion(false);
      }
    };

    if (roomId) {
      fetchConfusionAnalytics();
    }
  }, [roomId]);

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

  const participants = analysisData.participants.sort((a, b) => b.score - a.score);
  const top3 = participants.slice(0, 3);
  const others = participants.slice(3);

  const getStudentName = (studentId: string) => {
    const participant = participants.find((p) => p.userId === studentId || p.name === studentId);
    return participant ? participant.name : studentId;
  };

  const filteredParticipants = [...top3, ...others].filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalCorrect = participants.reduce((s, p) => s + p.correct, 0);
  const totalWrong = participants.reduce((s, p) => s + p.wrong, 0);
  const pieData = [
    { name: "Correct", value: totalCorrect, color: "#34d399" },
    { name: "Wrong", value: totalWrong, color: "#f87171" },
  ];

  const scoreRangeData = scoreRanges.map((range) => ({
    name: range.label,
    count: participants.filter((p) => p.score >= range.min && p.score <= range.max).length,
    color: range.color,
  }));

  const downloadExcel = () => {
    const data = participants.map((p, index) => ({
      Rank: index + 1,
      Name: p.name,
      Score: p.score,
      Correct: p.correct,
      Wrong: p.wrong,
      "Time Taken": p.timeTaken,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analysis");
    const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
    saveAs(blob, `${analysisData.name}-analysis.xlsx`);
  };

  // Format date if it's a string
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

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
          <div className="flex gap-2 items-center"><Users /> Total Participants: {participants.length}</div>
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
                <p>Score: {p.score}</p>
                <p>Correct/Wrong: {p.correct}/{p.wrong}</p>
                <p>Time: {p.timeTaken}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Participant List */}
      <Card className="shadow border border-indigo-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-indigo-700 dark:text-indigo-300">Participant Performance</CardTitle>
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
          <div className="grid grid-cols-5 p-2 font-semibold text-purple-700 dark:text-purple-300 text-sm border-b">
            <span>Name</span>
            <span>Score</span>
            <span>Correct</span>
            <span>Wrong</span>
            <span>Time Taken</span>
          </div>
          {filteredParticipants.map((p, i) => (
            <div
              key={i}
              className={`grid grid-cols-5 items-center p-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition ${i === 0 ? "bg-yellow-50 dark:bg-yellow-900" : i === 1 ? "bg-slate-100 dark:bg-slate-800" : i === 2 ? "bg-orange-50 dark:bg-orange-900" : ""
                }`}
            >
              <span>{["🥇", "🥈", "🥉"][i] || ""} {p.name}</span>
              <span>{p.score}</span>
              <span>{p.correct}</span>
              <span>{p.wrong}</span>
              <span>{p.timeTaken}</span>
            </div>
          ))}
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
          <CardTitle className="text-emerald-700 dark:text-emerald-400">Score Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scoreRangeData.map((r, i) => (
            <div key={i} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
              <span>{r.name}</span>
              <div className="h-3 w-1/2 bg-gray-200 rounded">
                <div
                  className="h-3 rounded"
                  style={{ width: `${(r.count / participants.length) * 100}%`, backgroundColor: r.color }}
                />
              </div>
              <span>{r.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Student Confusion Analytics */}
      <Card className="shadow border border-rose-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-rose-700 dark:text-rose-300">Student Confusion Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingConfusion ? (
            <div className="text-sm text-gray-600 dark:text-gray-300">Loading confusion analytics...</div>
          ) : confusionData.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No confusion reported yet.</div>
          ) : (
            <div className="space-y-2">
              {confusionData.map((item) => (
                <div key={`${item.studentId}-${item.clicks}`} className="flex justify-between items-center p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{getStudentName(item.studentId)}</span>
                  <span className="rounded-full px-3 py-1 text-sm font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                    Clicked {item.clicks} {item.clicks === 1 ? 'time' : 'times'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question-Level Analysis */}
      <Card className="shadow border border-pink-300 bg-white dark:bg-slate-800">
        <CardHeader>
          <CardTitle className="text-pink-700 dark:text-pink-300">Question-Level Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {analysisData.questions.map((q, i) => (
            <div key={i} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
              <span>Q{i + 1}: {q.text.substring(0, 50)}{q.text.length > 50 ? '...' : ''}</span>
              <div className="h-2 w-1/2 bg-gray-200 rounded">
                <div
                  className="h-2 rounded bg-pink-500"
                  style={{ width: `${(q.correctCount / participants.length) * 100}%` }}
                />
              </div>
              <span>{q.correctCount} correct</span>
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