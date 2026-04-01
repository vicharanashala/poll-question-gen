import * as React from "react";
import { cn } from "@/lib/utils"; // adjust path to your utils
import { Button } from "./button";

type TabsContextType = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
}

export function Tabs({ defaultValue, children, className, onValueChange, ...props }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  const handleTabChange = React.useCallback((value: string) => {
    setActiveTab(value);
    onValueChange?.(value);
  }, [onValueChange]);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={cn("flex flex-col", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TabsList({ children, className, ...props }: TabsListProps) {
  return (
    <div className={cn("inline-flex items-center rounded-lg bg-muted p-1", className)} {...props}>
      {children}
    </div>
  );
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

export function TabsTrigger({ value, children, className, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within <Tabs>");

  const isActive = ctx.activeTab === value;

  return (
    <Button
      type="button"
      onClick={() => ctx.setActiveTab(value)}
      aria-pressed={isActive}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
        isActive ? "bg-background text-foreground shadow-sm" : "hover:text-foreground/80",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export function TabsContent({ value, children, className, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within <Tabs>");

  if (ctx.activeTab !== value) return null;

  return (
    <div className={cn("mt-2", className)} {...props}>
      {children}
    </div>
  );
}
