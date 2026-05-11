import { AlertCircle, Loader2 } from "lucide-react";

export const LoadingState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center shadow-sm">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400" />
    </div>
    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{message}</p>
  </div>
);

export const EmptyState = ({
  title,
  message,
}: {
  title: string;
  message: string;
}) => (
  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-10 text-center shadow-sm">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/20">
      <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h3>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
  </div>
);
