import {
  Flame,
  TrendingUp,
  TrendingDown,
  Coins,
  Target,
  Timer,
  Trophy,
  LayoutDashboard,
  BookOpen,
  History,
} from "lucide-react";
import type { ComponentType } from "react";

type Tone = "primary" | "secondary" | "accent" | "neutral";

type KpiItem = {
  title: string;
  value: string;
  change: string;
  progress: number;
  progressWidthClass: string;
  direction: "up" | "down";
  icon: ComponentType<{ size?: number; className?: string }>;
  tone: Tone;
};

// ✅ DATA (ADDED BACK)
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "My Courses", icon: BookOpen, active: false },
  { label: "Achievements", icon: Trophy, active: false },
  { label: "History", icon: History, active: false },
];

const kpis: KpiItem[] = [
  { title: "Total Points", value: "24,500", change: "+8.4%", progress: 84, progressWidthClass: "w-[84%]", direction: "up", icon: Coins, tone: "primary" },
  { title: "Accuracy", value: "94%", change: "+2.1%", progress: 94, progressWidthClass: "w-[94%]", direction: "up", icon: Target, tone: "secondary" },
  { title: "Response Time", value: "42.5s", change: "-5.2s", progress: 78, progressWidthClass: "w-[78%]", direction: "down", icon: Timer, tone: "accent" },
  { title: "Streak", value: "5 days", change: "Top 18%", progress: 80, progressWidthClass: "w-[80%]", direction: "up", icon: Flame, tone: "neutral" },
];

const toneMap: Record<Tone, string> = {
  primary: "bg-blue-400/20 text-blue-100 border border-blue-300/30",
  secondary: "bg-cyan-400/20 text-cyan-100 border border-cyan-300/30",
  accent: "bg-indigo-400/20 text-indigo-100 border border-indigo-300/30",
  neutral: "bg-slate-300/20 text-slate-100 border border-slate-300/30",
};

const performanceTrend = [
  { value: 68, widthClass: "w-[68%]" },
  { value: 73, widthClass: "w-[73%]" },
  { value: 70, widthClass: "w-[70%]" },
  { value: 82, widthClass: "w-[82%]" },
  { value: 86, widthClass: "w-[86%]" },
  { value: 91, widthClass: "w-[91%]" },
  { value: 94, widthClass: "w-[94%]" },
];

const speedTrend = [
  { value: 56, widthClass: "w-[44%]" },
  { value: 52, widthClass: "w-[48%]" },
  { value: 49, widthClass: "w-[51%]" },
  { value: 47, widthClass: "w-[53%]" },
  { value: 45, widthClass: "w-[55%]" },
  { value: 43, widthClass: "w-[57%]" },
  { value: 42, widthClass: "w-[58%]" },
];

const badges = [
  { name: "Speed Demon", earned: true },
  { name: "Perfect Score", earned: true },
  { name: "Consistency Pro", earned: true },
  { name: "Master Solver", earned: false },
];

// ✅ COMPONENT
const AdvancedDashboard = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 text-blue-50">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col lg:flex-row">

      {/* Sidebar */}
      <aside className="w-full border-b border-blue-800 bg-blue-950/80 p-5 shadow-xl lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:p-6">
        <h1 className="text-lg font-bold text-blue-50">Academic Accelerator</h1>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex items-center gap-2 rounded-lg p-2.5 text-sm cursor-pointer transition-colors duration-200 ${
                  item.active
                    ? "bg-blue-700/40 text-blue-50"
                    : "text-blue-200 hover:bg-blue-800/50 hover:text-blue-50"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">

        <h2 className="text-2xl font-bold text-blue-50">Academic Pulse</h2>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-blue-900/70 border border-blue-700 p-4 rounded-xl shadow-lg transition-all duration-200 hover:ring-1 hover:ring-cyan-300/40">
                <div className="flex items-start justify-between gap-3">
                  <span className={`text-xs px-2 py-1 rounded ${toneMap[item.tone]}`}>
                    {item.title}
                  </span>
                  <Icon size={16} className="text-blue-200" />
                </div>

                <h3 className="mt-3 text-xl font-bold text-blue-50">{item.value}</h3>

                <p className="mt-1 text-xs flex items-center gap-1 text-blue-200">
                  {item.direction === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {item.change}
                </p>

                <div className="mt-3 h-2 bg-blue-800 rounded">
                  <div className={`h-2 bg-cyan-400 rounded ${item.progressWidthClass}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Trends */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          <div className="bg-blue-900/70 border border-blue-700 p-4 rounded-xl shadow-lg transition-all duration-200 hover:ring-1 hover:ring-cyan-300/40">
            <h3 className="font-semibold text-blue-50 mb-3">Accuracy</h3>
            {performanceTrend.map((item, i) => (
              <div key={i} className="mb-2">
                <span className="text-xs text-blue-200">Day {i + 1}</span>
                <div className="h-2 bg-blue-800 rounded">
                  <div className={`h-2 bg-cyan-400 rounded ${item.widthClass}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-900/70 border border-blue-700 p-4 rounded-xl shadow-lg transition-all duration-200 hover:ring-1 hover:ring-cyan-300/40">
            <h3 className="font-semibold text-blue-50 mb-3">Response Time</h3>
            {speedTrend.map((item, i) => (
              <div key={i} className="mb-2">
                <span className="text-xs text-blue-200">Day {i + 1}</span>
                <div className="h-2 bg-blue-800 rounded">
                  <div className={`h-2 bg-indigo-300 rounded ${item.widthClass}`} />
                </div>
              </div>
            ))}
          </div>

        </div>

        <div className="bg-blue-500/20 border border-blue-400 p-4 rounded shadow-sm">
          <p className="text-sm text-cyan-100">You're doing great! Keep your streak going 🔥</p>
        </div>

        {/* Achievements */}
        <div className="bg-blue-900/70 border border-blue-700 p-4 rounded-xl shadow-lg transition-all duration-200 hover:ring-1 hover:ring-cyan-300/40">
          <h3 className="font-semibold text-blue-50">Achievements</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {badges.map((b) => (
              <span
                key={b.name}
                className={`px-2 py-1 rounded text-xs border ${
                  b.earned
                    ? "bg-cyan-400/20 border-cyan-300/40 text-cyan-100"
                    : "bg-blue-800/60 border-blue-700 text-blue-200"
                }`}
              >
                {b.earned ? "🏆" : "🔒"} {b.name}
              </span>
            ))}
          </div>
        </div>

      </main>
      </div>
    </div>
  );
};

export default AdvancedDashboard;