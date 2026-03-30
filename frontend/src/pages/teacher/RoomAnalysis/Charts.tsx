import { LineChartPoint } from "@/shared/types";


export const LineChart = ({ data }: { data: LineChartPoint[] }) => {
  if (!data.length) {
    return (
      <div className="w-full h-40 mt-4 flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
        No engagement data available yet.
      </div>
    );
  }

  const values = data.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const hasSinglePoint = data.length === 1;
  const linePoints = data
    .map((point, i) => {
      const x = hasSinglePoint ? 50 : (i / (data.length - 1)) * 100;
      const y = 100 - ((point.value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const areaPoints = hasSinglePoint
    ? `0,100 50,${100 - ((data[0].value - min) / range) * 100} 100,100`
    : `0,100 ${linePoints} 100,100`;

  return (
    <div className="w-full h-40 flex items-end justify-between gap-1 mt-4 relative">
      <div className="absolute inset-0 flex flex-col justify-between text-xs text-slate-400 dark:text-slate-500 pointer-events-none pb-5">
        <span className="border-b border-slate-100 dark:border-slate-700/50 w-full text-right pr-2">{max}%</span>
        <span className="border-b border-slate-100 dark:border-slate-700/50 w-full text-right pr-2">{Math.round((max + min) / 2)}%</span>
        <span className="border-b border-slate-100 dark:border-slate-700/50 w-full text-right pr-2">{min}%</span>
      </div>
      <svg className="w-full h-full pb-5 pt-2" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={linePoints} />
        <polyline fill="#3b82f6" fillOpacity="0.1" stroke="none" points={areaPoints} />
      </svg>
      <div className="absolute bottom-0 w-full flex justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
        <span>{data[0].label}</span>
        <span>{data[Math.floor((data.length - 1) / 2)].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
};

export const BarChart = ({ data }: { data: Array<{ label: string; value: number }> }) => {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full h-48 flex items-end justify-around gap-2 mt-4">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
          <div
            className="w-full max-w-[40px] bg-indigo-500 dark:bg-indigo-600 rounded-t-sm transition-all duration-300 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 relative"
            style={{ height: `${(d.value / max) * 100}%` }}
          >
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
              {d.value}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 rotate-45 sm:rotate-0 origin-left">{d.label}</span>
        </div>
      ))}
    </div>
  );
};
