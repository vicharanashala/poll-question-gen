import { LineChartPoint } from "@/shared/types";


export const LineChart = ({ data }: { data: LineChartPoint[] }) => {
  if (!data.length) {
    return (
      <div className="w-full h-40 mt-4 flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400">
        No engagement data available yet.
      </div>
    );
  }

  const hasSinglePoint = data.length === 1;
  const chartPoints = data.map((point, i) => {
    const x = hasSinglePoint ? 50 : (i / (data.length - 1)) * 100;
    const clampedValue = Math.max(0, Math.min(100, point.value));
    const y = 100 - clampedValue;
    return { ...point, x, y };
  });
  const linePoints = chartPoints.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = hasSinglePoint
    ? `0,100 50,${chartPoints[0].y} 100,100`
    : `0,100 ${linePoints} 100,100`;

  // Smart Label & Dot Scaling Logic for large datasets (e.g., 100 questions)
  const maxLabels = 8;
  const labelStep = Math.ceil(data.length / maxLabels);

  // Dynamically shrink dots if we have a lot of data points
  const dotSize = data.length > 50 ? 4 : data.length > 20 ? 6 : 8;
  const dotBorder = data.length > 50 ? "border" : "border-2";

  return (
    <div className="w-full h-48 mt-4 relative font-sans flex flex-col">
      <div className="relative flex-grow w-full mx-auto" style={{ paddingBottom: '24px', paddingTop: '16px' }}>

        {/* Y-Axis Grid Lines */}
        <div className="absolute inset-0 pb-[24px] pt-[16px] pointer-events-none z-0">
          <div className="relative w-full h-full">
            {[100, 50, 0].map(percent => (
              <div 
                key={percent} 
                className="absolute w-full border-t border-slate-200 dark:border-slate-700/50" 
                style={{ top: `${100 - percent}%` }}
              >
                <span className="absolute right-0 bottom-full mb-1 text-[10px] text-slate-400 font-medium">
                  {percent}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG Area & Line (Stretches to fit container, thickness is preserved) */}
        <div className="absolute inset-0 pb-[24px] pt-[16px] z-10">
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
            <polyline 
              fill="#3b82f6" 
              fillOpacity="0.1" 
              stroke="none" 
              points={areaPoints} 
            />
            <polyline 
              fill="none" 
              stroke="#3b82f6" 
              strokeWidth="2" 
              strokeLinejoin="round" 
              strokeLinecap="round" 
              points={linePoints} 
              vectorEffect="non-scaling-stroke" // Prevents the line from getting thicker horizontally
            />
          </svg>
        </div>

        {/* HTML Dots (Prevents the "squashed ellipse / curve" bug) */}
        <div className="absolute inset-0 pb-[24px] pt-[16px] z-20 pointer-events-none">
          <div className="relative w-full h-full">
            {chartPoints.map(({ label, value, tooltip, x, y }) => (
              <div
                key={label}
                className={`absolute bg-white dark:bg-slate-800 ${dotBorder} border-blue-500 rounded-full shadow-sm pointer-events-auto cursor-pointer hover:scale-150 transition-transform origin-center`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                  transform: 'translate(-50%, -50%)'
                }}
                title={`${label}: ${value}%${tooltip ? ` - ${tooltip}` : ""}`}
              />
            ))}
          </div>
        </div>

        {/* Smart X-Axis Labels */}
        <div className="absolute bottom-0 w-full h-[24px] z-10">
          <div className="relative w-full h-full">
            {chartPoints.map(({ label, tooltip, x }, i) => {
              const isFirst = i === 0;
              const isLast = i === data.length - 1;
              
              // Only render labels based on the calculated step to prevent overlaps
              // Make sure the penultimate stepped label doesn't crash into the final label
              const isStepped = i % labelStep === 0 && (data.length - 1 - i) > (labelStep * 0.5);
              const showLabel = data.length <= maxLabels || isFirst || isLast || isStepped;

              if (!showLabel) return null;

              return (
                <div
                  key={`label-${label}-${i}`}
                  className="absolute text-[11px] text-slate-400 whitespace-nowrap pt-1 font-medium"
                  style={{
                    left: `${x}%`,
                    // Align first left, last right, center the rest
                    transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)'
                  }}
                  title={tooltip ?? label}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>

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
