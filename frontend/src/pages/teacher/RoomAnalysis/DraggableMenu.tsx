import { PointerEvent, useRef, useState } from "react";
import { Award, BarChart2, Plus, Target, Users } from "lucide-react";

export const DraggableMenu = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    setIsDragging(true);
    setHasDragged(false);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...pos };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setHasDragged(true);
    }

    setPos({
      x: posStart.current.x + dx,
      y: posStart.current.y + dy,
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleClick = () => {
    if (!hasDragged) {
      setIsOpen(!isOpen);
    }
  };

  const menuItems = [
    { id: "overview", icon: BarChart2, label: "Overview" },
    { id: "students", icon: Users, label: "Students" },
    { id: "questions", icon: Target, label: "Questions" },
    { id: "achievements", icon: Award, label: "Achievements" },
  ];

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3 touch-none"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
    >
      <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom ${isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center relative group transition-colors border ${
                isActive
                  ? "bg-indigo-600 text-white border-indigo-700"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              <Icon size={20} />
              <span className="absolute right-full mr-3 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none shadow-sm">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className="w-14 h-14 bg-indigo-600 rounded-full shadow-lg flex items-center justify-center text-white cursor-grab active:cursor-grabbing hover:bg-indigo-700 transition-colors z-10"
      >
        <Plus size={28} className={`transition-transform duration-300 pointer-events-none ${isOpen ? "rotate-45" : ""}`} />
      </button>
    </div>
  );
};
