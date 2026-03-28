import { useRef, useState, useEffect, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import {
  Calendar, Users,  Search, FileSpreadsheet, Hash, Shield, Activity, Award, BarChart2, Clock, Target,
  TrendingUp, TrendingDown, AlertCircle,
  Filter, ChevronDown, Plus,
  Info,
  Settings2
} from "lucide-react";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import api from "@/lib/api/api";
import { DashboardData } from "@/shared/types";
import LiveTimer from "@/components/LiveTimer";




// --- CHARTS COMPONENTS ---
const LineChart = ({ data }:{data:any}) => {
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

const BarChart = ({ data }:{data:any}) => {
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
const DraggableMenu = ({ activeTab, setActiveTab }:{activeTab:any,setActiveTab:any}) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e:any) => {
    setIsDragging(true);
    setHasDragged(false);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e:any) => {
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

  const handlePointerUp = (e:any) => {
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


  // Engagement graph mock data
  const [engagementData, setEngagementData] = useState([65, 70, 68, 85, 90, 88, 92, 95]);

  const [sortConfig, setSortConfig] = useState({ key: 'points', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');


  const handleSort = (key:string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // const sortedAndFilteredStudents = useMemo(() => {
  //   let filterableStudents = students.filter(s => 
  //     s.name.toLowerCase().includes(searchQuery.toLowerCase())
  //   );

  //   return filterableStudents.sort((a, b) => {
  //     if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
  //     if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
  //     return 0;
  //   });
  // }, [students, sortConfig, searchQuery]);

  // Generate Score Distribution for Bar Chart
  const scoreDistribution = useMemo(() => {
    const dist = [
      { label: '< 500', value: 0 },
      { label: '500-1k', value: 0 },
      { label: '1k-2k', value: 0 },
      { label: '2k-3k', value: 0 },
      { label: '> 3k', value: 0 }
    ];
    analysisData?.students.forEach(s => {
      if (s.points < 500) dist[0].value++;
      else if (s.points < 1000) dist[1].value++;
      else if (s.points < 2000) dist[2].value++;
      else if (s.points < 3000) dist[3].value++;
      else dist[4].value++;
    });
    return dist;
  }, [analysisData?.students]);

    const downloadExcel = () => {
    const data = analysisData?.students.map((p, index) => ({
      Rank: p.rank,
      Name: p.name,
      Score: p.points,
      Attempted: p.attempted,
      Correct: p.correct,
      Wrong: p.incorrect,
      UnAttempted: p.unAttempted,
      Missed: p.missed,
      "Time Taken": p.totalTime,
    }));
    const ws = XLSX.utils.json_to_sheet(data as any);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Analysis");
    const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]);
    saveAs(blob, `${analysisData?.overview.name}-analysis.xlsx`);
  };


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
      {analysisData?.questions.length === 0 && (
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
                  Running: <LiveTimer className="text-emerald-500 font-semibold" createdAt={analysisData.overview.createdAt}/> s
                </span>
              ) : (
                <span>Duration: 0</span>
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
            onClick={downloadExcel}
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
     <div className="mt-12 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
  <div className="flex items-center justify-between mb-6">
    <div>
      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <Settings2 size={16} className="text-indigo-500" />
        Scoring Configuration & Logic
      </h4>
      <p className="text-xs text-slate-500 mt-1">How session points are calculated for this assessment</p>
    </div>
    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded uppercase">
      Automated Grading
    </span>
  </div>

  <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
    <ul className="list-disc space-y-1 pl-5">
      <li>Each question has its own maximum points.</li>
      <li>Points are calculated based on response time.</li>
      <li>Wrong or unattempted answers receive 0 points.</li>
    </ul>
  </div>

  {/* Teacher Reference Table */}
  <div className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
        <tr>
          <th className="px-4 py-2 font-bold">Performance Tier</th>
          <th className="px-4 py-2 font-bold">Response Time</th>
          <th className="px-4 py-2 font-bold text-right">Points Earned</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
        <tr>
          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">Correct and Very Fast</td>
          <td className="px-4 py-3">Near 0s</td>
          <td className="px-4 py-3 text-right font-bold text-emerald-600">Near maxPoints</td>
        </tr>
        <tr>
          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">Correct Answer with Average Speed</td>
          <td className="px-4 py-3">Around the middle of the timer</td>
          <td className="px-4 py-3 text-right font-bold">Around half of maxPoints</td>
        </tr>
        <tr>
          <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">Correct Just Before Time Runs Out</td>
          <td className="px-4 py-3">Just before the timer ends</td>
          <td className="px-4 py-3 text-right font-bold">At least 1 point</td>
        </tr>
        <tr className="bg-slate-50/50 dark:bg-slate-800/20">
          <td className="px-4 py-3 font-medium text-red-500">Wrong Answer or No Answer</td>
          <td className="px-4 py-3">Incorrect answer or no response</td>
          <td className="px-4 py-3 text-right font-bold text-red-500">0</td>
        </tr>
      </tbody>
    </table>
  </div>

  {/* Formula Tooltip */}
  <p className="mt-4 text-xs text-slate-500 flex items-center gap-1">
    <Info size={12} />
    Correct answers earn more points when submitted faster. Wrong or unattempted answers receive 0 points.
  </p>
</div>

      {/* DRAGGABLE FLOATING MENU (LEAF DESIGN) */}
      <DraggableMenu activeTab={activeTab} setActiveTab={setActiveTab} />
      
    </div>
  );
}
