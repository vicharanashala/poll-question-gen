
// interface Participant {
//   name: string;
//   score: number;
//   correct: number;
//   wrong: number;
//   timeTaken: string;
// }

// interface Question {
//   text: string;
//   correctCount: number;
// }

// interface AnalysisData {
//   id: string;
//   name: string;
//   createdAt: string;
//   duration: string;
//   participants: Participant[];
//   questions: Question[];
// }

// const scoreRanges = [
//   { label: "90–100", min: 90, max: 100, color: "#10b981" },
//   { label: "80–89", min: 80, max: 89, color: "#6366f1" },
//   { label: "70–79", min: 70, max: 79, color: "#f59e0b" },
//   { label: "60–69", min: 60, max: 69, color: "#ef4444" },
// ];

// export default function TeacherPollAnalysis() {
//   const ref = useRef<HTMLDivElement>(null);
//   const { roomId } = useParams({ from: "/teacher/manage-rooms/pollanalysis/$roomId" });

//   const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [search, setSearch] = useState("");

//   useEffect(() => {
//     const fetchAnalysisData = async () => {
//       try {
//         setLoading(true);
//         // Note: Update this URL to match your backend base URL
//         const response = await api.get(`/livequizzes/rooms/${roomId}/analysis`);
//         const result = response.data;

//         if (result.success) {
//           setAnalysisData(result.data);
//         } else {
//           throw new Error('Failed to get analysis data');
//         }
//       } catch (err) {
//         if (err instanceof Error) {
//           setError(err.message);
//         }
//         console.error('Error fetching analysis data:', err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (roomId) {
//       fetchAnalysisData();
//     }
//   }, [roomId]);

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
//         <span className="ml-2 text-lg">Loading analysis data...</span>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="text-center">
//           <p className="text-red-600 text-lg mb-4">Error: {error}</p>
//           <button
//             onClick={() => window.location.reload()}
//             className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
//           >
//             Retry
//           </button>
//         </div>
//       </div>
//     );
//   }

//   if (!analysisData) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <p className="text-gray-600 text-lg">No analysis data available</p>
//       </div>
//     );
//   }

//   const participants = analysisData.participants.sort((a, b) => b.score - a.score);
//   const top3 = participants.slice(0, 3);
//   const others = participants.slice(3);

//   const filteredParticipants = [...top3, ...others].filter((p) =>
//     p.name.toLowerCase().includes(search.toLowerCase())
//   );

//   const totalCorrect = participants.reduce((s, p) => s + p.correct, 0);
//   const totalWrong = participants.reduce((s, p) => s + p.wrong, 0);
//   const pieData = [
//     { name: "Correct", value: totalCorrect, color: "#34d399" },
//     { name: "Wrong", value: totalWrong, color: "#f87171" },
//   ];

//   const scoreRangeData = scoreRanges.map((range) => ({
//     name: range.label,
//     count: participants.filter((p) => p.score >= range.min && p.score <= range.max).length,
//     color: range.color,
//   }));

//   const downloadExcel = () => {
//     const data = participants.map((p, index) => ({
//       Rank: index + 1,
//       Name: p.name,
//       Score: p.score,
//       Correct: p.correct,
//       Wrong: p.wrong,
//       "Time Taken": p.timeTaken,
//     }));
//     const ws = XLSX.utils.json_to_sheet(data);
//     const wb = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb, ws, "Analysis");
//     const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
//     saveAs(blob, `${analysisData.name}-analysis.xlsx`);
//   };

//   // Format date if it's a string
//   const formatDate = (dateString: string | Date) => {
//     if (!dateString) return 'N/A';
//     const date = new Date(dateString);
//     return date.toLocaleDateString();
//   };

//   return (
//     <div
//       className="p-6 space-y-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
//       ref={ref}
//     >
//       {/* Room Details */}
//       <Card className="shadow-lg border border-purple-300 bg-white dark:bg-slate-800">
//         <CardHeader>
//           <CardTitle className="text-2xl text-purple-600 dark:text-purple-300">Room: {analysisData.name}</CardTitle>
//         </CardHeader>
//         <CardContent className="flex gap-8 flex-wrap text-gray-800 dark:text-gray-200">
//           <div className="flex gap-2 items-center"><Calendar /> {formatDate(analysisData.createdAt)}</div>
//           <div className="flex gap-2 items-center"><Clock4 /> Duration: {analysisData.duration}</div>
//           <div className="flex gap-2 items-center"><Users /> Total Participants: {participants.length}</div>
//         </CardContent>
//       </Card>

//       {/* Top Performers */}
//       <div className="grid md:grid-cols-3 gap-4">
//         {top3.map((p, i) => {
//           const Icon = i === 0 ? Crown : Medal;
//           const badge = ["🥇", "🥈", "🥉"][i];
//           const bgLight = ["bg-yellow-100", "bg-yellow-200", "bg-yellow-50"];
//           const bgDark = ["dark:bg-yellow-900", "dark:bg-yellow-800", "dark:bg-yellow-700"];
//           return (
//             <Card
//               key={p.name}
//               className={`
//           shadow-lg dark:shadow-yellow-800 border border-yellow-300 
//           ${bgLight[i]} ${bgDark[i]} 
//           text-gray-800 dark:text-yellow-100
//         `}
//             >
//               <CardHeader className="flex gap-2 items-center">
//                 <Icon className="text-yellow-500" />
//                 <CardTitle className="text-yellow-700 dark:text-yellow-300">{badge} {p.name}</CardTitle>
//               </CardHeader>
//               <CardContent className="space-y-1 text-sm">
//                 <p>Score: {p.score}</p>
//                 <p>Correct/Wrong: {p.correct}/{p.wrong}</p>
//                 <p>Time: {p.timeTaken}</p>
//               </CardContent>
//             </Card>
//           );
//         })}
//       </div>


//       {/* Participant List */}
//       <Card className="shadow border border-indigo-300 bg-white dark:bg-slate-800">
//         <CardHeader>
//           <CardTitle className="text-indigo-700 dark:text-indigo-300">Participant Performance</CardTitle>
//           <div className="mt-2 flex items-center gap-2">
//             <Search className="w-4 h-4 text-gray-500" />
//             <input
//               type="text"
//               placeholder="Search by name..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               className="p-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm bg-white dark:bg-slate-700 dark:text-white"
//             />
//           </div>
//         </CardHeader>
//         <CardContent className="max-h-96 overflow-y-auto divide-y rounded scrollbar-thin scrollbar-thumb-purple-500">
//           <div className="grid grid-cols-5 p-2 font-semibold text-purple-700 dark:text-purple-300 text-sm border-b">
//             <span>Name</span>
//             <span>Score</span>
//             <span>Correct</span>
//             <span>Wrong</span>
//             <span>Time Taken</span>
//           </div>
//           {filteredParticipants.map((p, i) => (
//             <div
//               key={i}
//               className={`grid grid-cols-5 items-center p-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition ${i === 0 ? "bg-yellow-50 dark:bg-yellow-900" : i === 1 ? "bg-slate-100 dark:bg-slate-800" : i === 2 ? "bg-orange-50 dark:bg-orange-900" : ""
//                 }`}
//             >
//               <span>{["🥇", "🥈", "🥉"][i] || ""} {p.name}</span>
//               <span>{p.score}</span>
//               <span>{p.correct}</span>
//               <span>{p.wrong}</span>
//               <span>{p.timeTaken}</span>
//             </div>
//           ))}
//         </CardContent>
//       </Card>

//       {/* Pie Chart */}
//       <Card className="shadow border border-purple-300 bg-white dark:bg-slate-800">
//         <CardHeader>
//           <CardTitle className="text-green-600 dark:text-green-400">Overall Answer Accuracy</CardTitle>
//         </CardHeader>
//         <CardContent className="flex justify-center">
//           <PieChart width={300} height={300}>
//             <Pie
//               data={pieData}
//               dataKey="value"
//               nameKey="name"
//               outerRadius={100}
//               label
//             >
//               {pieData.map((entry, index) => (
//                 <Cell key={`cell-${index}`} fill={entry.color} />
//               ))}
//             </Pie>
//             <Tooltip />
//             <Legend />
//           </PieChart>
//         </CardContent>
//       </Card>

//       {/* Score Distribution */}
//       <Card className="shadow border border-green-300 bg-white dark:bg-slate-800">
//         <CardHeader>
//           <CardTitle className="text-emerald-700 dark:text-emerald-400">Score Distribution</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-2">
//           {scoreRangeData.map((r, i) => (
//             <div key={i} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
//               <span>{r.name}</span>
//               <div className="h-3 w-1/2 bg-gray-200 rounded">
//                 <div
//                   className="h-3 rounded"
//                   style={{ width: `${(r.count / participants.length) * 100}%`, backgroundColor: r.color }}
//                 />
//               </div>
//               <span>{r.count}</span>
//             </div>
//           ))}
//         </CardContent>
//       </Card>

//       {/* Question-Level Analysis */}
//       <Card className="shadow border border-pink-300 bg-white dark:bg-slate-800">
//         <CardHeader>
//           <CardTitle className="text-pink-700 dark:text-pink-300">Question-Level Analysis</CardTitle>
//         </CardHeader>
//         <CardContent className="space-y-2">
//           {analysisData.questions.map((q, i) => (
//             <div key={i} className="flex justify-between items-center text-sm text-gray-700 dark:text-gray-300">
//               <span>Q{i + 1}: {q.text.substring(0, 50)}{q.text.length > 50 ? '...' : ''}</span>
//               <div className="h-2 w-1/2 bg-gray-200 rounded">
//                 <div
//                   className="h-2 rounded bg-pink-500"
//                   style={{ width: `${(q.correctCount / participants.length) * 100}%` }}
//                 />
//               </div>
//               <span>{q.correctCount} correct</span>
//             </div>
//           ))}
//         </CardContent>
//       </Card>

//       {/* Download Button */}
//       <div className="text-center mt-4">
//         <button
//           onClick={downloadExcel}
//           className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition"
//         >
//           Download as Excel
//         </button>
//       </div>
//           <MainApp />
//     </div>
//   );
// }

import { useRef, useState, useEffect, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Calendar, Clock4, Users, Crown, Medal, Search, Loader2, FileSpreadsheet, Hash, Shield, Activity, Award, BarChart2, Clock, Target,
  TrendingUp, TrendingDown, AlertCircle,
  Filter, ChevronDown, Zap, Plus
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import api from "@/lib/api/api";
import { DashboardData } from "@/shared/types";


// --- MOCK DATA ---
const ROOMS = [
  { id: 'r1', name: 'CS202 - Advanced React', session: 'ses_1092', status: 'live', startTime: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: 'r2', name: 'CS101 - Web Fundamentals', session: 'ses_1091', status: 'completed', startTime: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
];


const INITIAL_SESSION_DATA = {
  'r1': { totalStudents: 42, questionsAsked: 12, pointsDistributed: 18450, avgAccuracy: 68 },
  'r2': { totalStudents: 35, questionsAsked: 15, pointsDistributed: 21200, avgAccuracy: 82 },
};

const INITIAL_STUDENTS = [
  // Room 1 Students
  { id: 's1', roomId: 'r1', name: 'Alex Johnson', attempted: 12, correct: 10, incorrect: 2, points: 2150, avgTime: '12s', badges: ['Speedster', 'Flawless'] },
  { id: 's2', roomId: 'r1', name: 'Maria Garcia', attempted: 12, correct: 11, incorrect: 1, points: 2400, avgTime: '18s', badges: ['Top Scorer'] },
  { id: 's3', roomId: 'r1', name: 'James Smith', attempted: 10, correct: 6, incorrect: 4, points: 1100, avgTime: '24s', badges: [] },
  { id: 's4', roomId: 'r1', name: 'Linda Wong', attempted: 12, correct: 8, incorrect: 4, points: 1650, avgTime: '15s', badges: ['Consistent'] },
  { id: 's5', roomId: 'r1', name: 'Robert Chen', attempted: 11, correct: 9, incorrect: 2, points: 1890, avgTime: '14s', badges: ['Speedster'] },
  { id: 's6', roomId: 'r1', name: 'Sarah Davis', attempted: 12, correct: 12, incorrect: 0, points: 2800, avgTime: '11s', badges: ['Top Scorer', 'Speedster', 'Flawless'] },
  // Room 2 Students
  { id: 's7', roomId: 'r2', name: 'Michael Brown', attempted: 15, correct: 14, incorrect: 1, points: 3100, avgTime: '10s', badges: ['Top Scorer'] },
  { id: 's8', roomId: 'r2', name: 'Emily Wilson', attempted: 15, correct: 12, incorrect: 3, points: 2420, avgTime: '14s', badges: ['Consistent'] },
  { id: 's9', roomId: 'r2', name: 'David Lee', attempted: 12, correct: 5, incorrect: 7, points: 950, avgTime: '28s', badges: [] },
];

const INITIAL_QUESTIONS = [
  // Room 1 Questions
  { id: 'q1', roomId: 'r1', text: 'What is the primary purpose of useMemo?', responses: 42, correctPct: 85, avgTime: '14s', difficulty: 'Low', engagement: 'High', avgPoints: 180 },
  { id: 'q2', roomId: 'r1', text: 'Explain the difference between context and Redux.', responses: 41, correctPct: 62, avgTime: '28s', difficulty: 'Medium', engagement: 'High', avgPoints: 145 },
  { id: 'q3', roomId: 'r1', text: 'How does React fiber architecture improve rendering?', responses: 38, correctPct: 35, avgTime: '42s', difficulty: 'High', engagement: 'Low', avgPoints: 90 },
  // Room 2 Questions
  { id: 'q4', roomId: 'r2', text: 'What does HTML stand for?', responses: 35, correctPct: 98, avgTime: '5s', difficulty: 'Low', engagement: 'High', avgPoints: 95 },
  { id: 'q5', roomId: 'r2', text: 'Which CSS property controls text size?', responses: 35, correctPct: 92, avgTime: '8s', difficulty: 'Low', engagement: 'High', avgPoints: 90 },
];

const ACHIEVEMENTS = [
  { id: 'a1', name: 'Top Scorer', icon: <Award className="text-yellow-500 w-6 h-6" />, desc: 'Ranked in the top 5% of the session', count: 2 },
  { id: 'a2', name: 'Speedster', icon: <Zap className="text-blue-500 w-6 h-6" />, desc: 'Answered 5 questions correctly in under 10 seconds', count: 8 },
  { id: 'a3', name: 'Flawless', icon: <Target className="text-green-500 w-6 h-6" />, desc: '100% accuracy on attempted questions (min 5)', count: 4 },
  { id: 'a4', name: 'Consistent', icon: <Activity className="text-purple-500 w-6 h-6" />, desc: 'Maintained an answer streak of 8 questions', count: 12 },
];

// --- CHARTS COMPONENTS ---
const LineChart = ({ data }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  return (
    <div className="w-full h-40 flex items-end justify-between gap-1 mt-4 relative">
      <div className="absolute inset-0 flex flex-col justify-between text-xs text-slate-400 dark:text-slate-500 pointer-events-none pb-5">
        <span className="border-b border-slate-100 dark:border-slate-700/50 w-full text-right pr-2">{max}</span>
        <span className="border-b border-slate-100 dark:border-slate-700/50 w-full text-right pr-2">{Math.round((max+min)/2)}</span>
        <span className="border-b border-slate-100 dark:border-slate-700/50 w-full text-right pr-2">{min}</span>
      </div>
      <svg className="w-full h-full pb-5 pt-2" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polyline
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          points={data.map((val, i) => `${(i / (data.length - 1)) * 100},${100 - ((val - min) / range) * 100}`).join(' ')}
        />
        <polyline
          fill="#3b82f6"
          fillOpacity="0.1"
          stroke="none"
          points={`0,100 ${data.map((val, i) => `${(i / (data.length - 1)) * 100},${100 - ((val - min) / range) * 100}`).join(' ')} 100,100`}
        />
      </svg>
      <div className="absolute bottom-0 w-full flex justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
        <span>Start</span>
        <span>Mid</span>
        <span>Now</span>
      </div>
    </div>
  );
};

const BarChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="w-full h-48 flex items-end justify-around gap-2 mt-4">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
          <div className="w-full max-w-[40px] bg-indigo-500 dark:bg-indigo-600 rounded-t-sm transition-all duration-300 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 relative" 
               style={{ height: `${(d.value / max) * 100}%` }}>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
              {d.value}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 rotate-45 sm:rotate-0 origin-left">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// --- DRAGGABLE MENU COMPONENT ---
const DraggableMenu = ({ activeTab, setActiveTab }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    setIsDragging(true);
    setHasDragged(false);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setHasDragged(true);
    }

    setPos({
      x: posStart.current.x + dx,
      y: posStart.current.y + dy
    });
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.target.releasePointerCapture(e.pointerId);
  };

  const handleClick = () => {
    if (!hasDragged) {
      setIsOpen(!isOpen);
    }
  };

  const menuItems = [
    { id: 'overview', icon: BarChart2, label: 'Overview' },
    { id: 'students', icon: Users, label: 'Students' },
    { id: 'questions', icon: Target, label: 'Questions' },
    { id: 'achievements', icon: Award, label: 'Achievements' },
  ];

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3 touch-none"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      {/* Leaves (Menu Options) */}
      <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
              className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center relative group transition-colors border ${
                isActive 
                  ? 'bg-indigo-600 text-white border-indigo-700' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={20} />
              <span className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none shadow-sm">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Draggable Button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className="w-14 h-14 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center text-white cursor-grab active:cursor-grabbing hover:bg-indigo-700 transition-colors z-10"
      >
        <Plus size={28} className={`transition-transform duration-300 pointer-events-none ${isOpen ? 'rotate-45' : ''}`} />
      </button>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function TeacherPollAnalysis() {

  const { roomId } = useParams({ from: "/teacher/manage-rooms/pollanalysis/$roomId" });

   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [analysisData, setAnalysisData] = useState<DashboardData | null>(null);

    useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        // Note: Update this URL to match your backend base URL
        const response = await api.get(`/livequizzes/rooms/${roomId}/analysis`);
        const result = response.data;
        console.log('res:',result)
        if (result.success) {
          setAnalysisData(result.data.dashboard);
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
  const [activeTab, setActiveTab] = useState('overview');
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(ROOMS[0].id);
  
  // State for data
  const [sessionsData, setSessionsData] = useState(INITIAL_SESSION_DATA);
  const [allStudents, setAllStudents] = useState(INITIAL_STUDENTS);
  
  const selectedRoom = ROOMS.find(r => r.id === selectedRoomId);
  const currentSession = sessionsData[selectedRoomId];
  const students = allStudents.filter(s => s.roomId === selectedRoomId);
  const questions = INITIAL_QUESTIONS.filter(q => q.roomId === selectedRoomId);

  // Engagement graph mock data
  const [engagementData, setEngagementData] = useState([65, 70, 68, 85, 90, 88, 92, 95]);

  const [sortConfig, setSortConfig] = useState({ key: 'points', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');

  // Simulate real-time updates for LIVE rooms
  useEffect(() => {
    let interval;
    if (isLiveMode && selectedRoom.status === 'live') {
      interval = setInterval(() => {
        setSessionsData(prev => ({
          ...prev,
          [selectedRoomId]: {
            ...prev[selectedRoomId],
            pointsDistributed: prev[selectedRoomId].pointsDistributed + Math.floor(Math.random() * 50),
            avgAccuracy: Math.min(100, Math.max(0, prev[selectedRoomId].avgAccuracy + (Math.random() > 0.5 ? 1 : -1)))
          }
        }));
        
        setAllStudents(prev => {
          const newStudents = [...prev];
          const roomStudentsIdxs = newStudents.map((s, i) => s.roomId === selectedRoomId ? i : -1).filter(i => i !== -1);
          if (roomStudentsIdxs.length > 0) {
            const randomIdx = roomStudentsIdxs[Math.floor(Math.random() * roomStudentsIdxs.length)];
            newStudents[randomIdx] = {
              ...newStudents[randomIdx],
              points: newStudents[randomIdx].points + Math.floor(Math.random() * 20)
            };
          }
          return newStudents;
        });

        setEngagementData(prev => {
          const newData = [...prev.slice(1), Math.min(100, Math.max(40, prev[prev.length-1] + (Math.random() * 10 - 5)))];
          return newData;
        });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isLiveMode, selectedRoom.status, selectedRoomId]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredStudents = useMemo(() => {
    let filterableStudents = students.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filterableStudents.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, sortConfig, searchQuery]);

  // Generate Score Distribution for Bar Chart
  const scoreDistribution = useMemo(() => {
    const dist = [
      { label: '< 500', value: 0 },
      { label: '500-1k', value: 0 },
      { label: '1k-2k', value: 0 },
      { label: '2k-3k', value: 0 },
      { label: '> 3k', value: 0 }
    ];
    students.forEach(s => {
      if (s.points < 500) dist[0].value++;
      else if (s.points < 1000) dist[1].value++;
      else if (s.points < 2000) dist[2].value++;
      else if (s.points < 3000) dist[3].value++;
      else dist[4].value++;
    });
    return dist;
  }, [students]);


  // --- TABS COMPONENTS ---

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* KPI Cards Container */}
<div className="flex flex-wrap items-center justify-center gap-4">
  
  {/* Card Template (Repeat for all 5) */}
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
      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{analysisData?.overview.totalStudents ?? 0}</h3>
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
        {/* Graphs Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
            <Activity size={20} className="text-blue-500 dark:text-blue-400" />
            Session Engagement
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Real-time interaction intensity over the last 30 minutes.</p>
          <div className="flex-1 min-h-[160px]">
            <LineChart data={engagementData} />
          </div>
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

        {/* Quick Insights */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 transition-colors lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-500 dark:text-amber-400" />
            AI-Powered Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/30">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-2">
                <TrendingDown size={18} /> Needs Attention
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">Q3 has only 35% accuracy. Consider reviewing this topic before proceeding.</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold mb-2">
                <TrendingUp size={18} /> Strong Engagement
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">95% of students have attempted all live questions in this room.</p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold mb-2">
                <Clock size={18} /> Speed Analysis
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">Avg response is 18s. Speedster badge awarded to 20% of the class.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const StudentsTab = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-auto sm:h-[600px] transition-colors">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Student Performance</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search students..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
            <Filter size={16} /> <span className="hidden sm:inline">Filter</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[700px]">
          <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 font-semibold sticky top-0 z-10 transition-colors">
            <tr>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">Student Name {sortConfig.key === 'name' && <ChevronDown size={14} className={sortConfig.direction === 'asc' ? 'rotate-180' : ''}/>}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('attempted')}>
                <div className="flex items-center gap-1">Attempted {sortConfig.key === 'attempted' && <ChevronDown size={14} />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('attempted')}>
                <div className="flex items-center gap-1">UnAttempted {sortConfig.key === 'unAttempted' && <ChevronDown size={14} />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('attempted')}>
                <div className="flex items-center gap-1">Missed {sortConfig.key === 'missed' && <ChevronDown size={14} />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('correct')}>
                <div className="flex items-center gap-1">Accuracy {sortConfig.key === 'correct' && <ChevronDown size={14} />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('avgTime')}>
                <div className="flex items-center gap-1">Avg Time {sortConfig.key === 'avgTime' && <ChevronDown size={14} />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleSort('points')}>
                <div className="flex items-center gap-1">Total Points {sortConfig.key === 'points' && <ChevronDown size={14} />}</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {analysisData?.students?.map(student => (
              <tr key={student.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4 font-medium text-slate-800 dark:text-slate-100">{student.name}</td>
                <td className="p-4">{student.attempted} / {analysisData?.overview?.questionsAsked ?? 0}</td>
                <td className="p-4">{student.unAttempted} / {analysisData?.overview?.questionsAsked ?? 0}</td>
                <td className="p-4">{student.missed} / {analysisData?.overview?.questionsAsked ?? 0}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="w-10">{Math.round((student.correct/student.attempted)*100)}%</span>
                    <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${student.correct/student.attempted > 0.7 ? 'bg-emerald-500' : student.correct/student.attempted > 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${(student.correct/student.attempted)*100}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    <span className="text-emerald-600 dark:text-emerald-400">{student.correct} ✓</span> | <span className="text-red-500 dark:text-red-400">{student.incorrect} ✗</span>
                  </div>
                </td>
                <td className="p-4 text-slate-500 dark:text-slate-400">{student.avgTime}</td>
                <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">{student.points.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const QuestionsTab = () => (
    <div className="space-y-4">
      {analysisData?.questions?.map((q, idx) => (
        <div key={idx} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-colors">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-bold text-slate-400 dark:text-slate-500">Q{idx + 1}</span>
                {q.difficulty === 'Hard' && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">High Difficulty</span>}
                {q.engagement === 'Low' && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Low Engagement</span>}
              </div>
              <h4 className="text-lg font-medium text-slate-800 dark:text-white">{q.text}</h4>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-slate-500 dark:text-slate-400 mb-1">Responses</p>
                <p className="font-bold text-slate-800 dark:text-white">{q.responses} <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">/ {analysisData?.overview?.totalStudents ?? 0}</span></p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 dark:text-slate-400 mb-1">Avg Time</p>
                <p className="font-bold text-slate-800 dark:text-white">{q.avgTime}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 dark:text-slate-400 mb-1">Avg Points</p>
                <p className="font-bold text-indigo-600 dark:text-indigo-400">{q.avgPoints}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Accuracy Rate: {q.correctPct}%</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{q.correctPct > 50 ? 'Performing as expected' : 'Requires attention'}</span>
            </div>
            <div className="w-full h-3 bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 dark:bg-emerald-400 h-full transition-all duration-500" style={{ width: `${q.correctPct}%` }}></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-500 mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      ))}
      {questions.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          No questions found for this room.
        </div>
      )}
    </div>
  );

  const AchievementsTab = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Achievement Distribution</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Read-only view of badges awarded based on session rules.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {analysisData?.achievements?.badges?.map((ach, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700 text-center relative overflow-hidden group transition-colors">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white dark:bg-slate-800 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="w-14 h-14 mx-auto bg-white dark:bg-slate-800 rounded-full shadow-sm flex items-center justify-center mb-3 relative z-10 border border-slate-100 dark:border-slate-700">
                {/* {ach.icon} */}
                <Award className="text-yellow-500 w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 dark:text-white">{ach.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 h-8">{ach.description}</p>
              <div className="inline-block bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-100 dark:border-slate-700">
                {ach.earned} Earned
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <h3 className="text-md font-bold text-slate-800 dark:text-white mb-4">Recent Awards in {`${analysisData?.overview.roomCode}-${analysisData?.overview.name}`}</h3>
        <div className="space-y-3">
          {analysisData?.achievements?.students?.slice(0, 5).map((student, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
              <span className="font-medium text-slate-700 dark:text-slate-200">{student.name}</span>
              <div className="flex gap-2 flex-wrap">
                {student.earnedBadges.map(b => (
                   <span key={b} className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                     <Award size={12} /> {b}
                   </span>
                ))}
              </div>
            </div>
          ))}
          {analysisData?.achievements?.students?.filter(s => s.earnedBadges.length > 0).length === 0 && (
             <div className="text-sm text-slate-500 dark:text-slate-400">No recent awards in this room.</div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col font-sans relative pb-24 bg-transparent">
      
      {/* COMPONENT HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          {/* Room Name and Status Display */}
          <div className="flex items-center gap-3 mb-1.5">
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              {`${analysisData?.overview.roomCode}-${analysisData?.overview.name}`}
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 border ${
              analysisData?.overview.status === 'active' 
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}>
              {analysisData?.overview.status === 'active' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
              {analysisData?.overview.status}
            </span>
          </div>

          {/* NEW: Room Metadata (Code, Date, Running Time/Duration) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 mb-4 text-sm text-slate-500 dark:text-slate-400">
            {/* Room Code */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
              <Hash size={14} className="text-indigo-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {analysisData?.overview.roomCode}
              </span>
            </div>
            
            {/* Created At */}
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>{analysisData?.overview?.createdAt}</span>
            </div>

            {/* Duration or Running Time */}
            <div className="flex items-center gap-1.5">
              <Clock size={14} className={analysisData?.overview.status === 'active' ? 'text-emerald-500' : ''} />
              {analysisData?.overview.status === 'active' ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Running: {Date.now() - new Date(analysisData?.overview.createdAt).getTime()} ms
                </span>
              ) : (
                <span>Duration: {analysisData?.overview.endedAt}</span>
              )}
            </div>
          </div>

          <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 capitalize">
            {activeTab} Analytics
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Room Selector (Commented out as in original) */}
          {/* <div className="relative">...</div> */}

          {/* Simulate Live Toggle (Commented out as in original) */}
          {/* {selectedRoom.status === 'live' && (...)} */}

          {/* NEW: Excel Report Button */}
          <button 
            type="button"
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent active:scale-95"
            onClick={() => alert('Downloading Excel report...')}
          >
            <FileSpreadsheet size={18} className="text-emerald-600 dark:text-emerald-400" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="w-full">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'students' && <StudentsTab />}
        {activeTab === 'questions' && <QuestionsTab />}
        {activeTab === 'achievements' && <AchievementsTab />}
      </div>

      {/* SCORING RULES SECTION (AT THE BOTTOM) */}
      <div className="mt-12 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
           Session Scoring Rules
           <AlertCircle size={14} className="text-slate-400" />
        </h4>
        <div className="flex flex-col sm:flex-row gap-6 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400"></span><span className="text-slate-500 dark:text-slate-400">Base Points:</span> <span className="font-bold text-slate-800 dark:text-slate-200">100 / q</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span className="text-slate-500 dark:text-slate-400">Speed Bonus:</span> <span className="font-bold text-emerald-600 dark:text-emerald-400">Up to +50</span></div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-slate-500 dark:text-slate-400">Time Penalty:</span> <span className="font-bold text-red-500 dark:text-red-400">-1 / sec</span></div>
        </div>
      </div>

      {/* DRAGGABLE FLOATING MENU (LEAF DESIGN) */}
      <DraggableMenu activeTab={activeTab} setActiveTab={setActiveTab} />
      
    </div>
  );
}