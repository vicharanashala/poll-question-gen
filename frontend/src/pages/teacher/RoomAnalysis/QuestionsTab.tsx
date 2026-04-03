import { useState } from "react";
import { PaginationMeta, QuestionStats } from "@/shared/types";
import { PaginationControls } from "./PaginationControls";
import { useRoomQuestions } from "@/lib/api/roomAnalysisHooks";

type Props = {
  roomId: string;
  totalStudents: number;
};

const QUESTION_PAGE_SIZE = 5;

const emptyPagination = (pageSize: number): PaginationMeta => ({
  currentPage: 1,
  pageSize,
  totalItems: 0,
  totalPages: 0,
});

export const QuestionsTab = ({ roomId, totalStudents }: Props) => {
  const [questionPage, setQuestionPage] = useState(1);

  const questionsQuery = useRoomQuestions(roomId, { questionPage, questionPageSize: QUESTION_PAGE_SIZE });

  const questions = questionsQuery.data?.items ?? [];
  const pagination = questionsQuery.data?.pagination ?? emptyPagination(QUESTION_PAGE_SIZE);
  const isLoading = questionsQuery.isLoading;

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      {isLoading &&
        Array.from({ length: 3 }).map((_, idx) => (
          <div key={`question-loading-${idx}`} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 animate-pulse">
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700 mb-3" />
            <div className="h-6 w-2/3 rounded bg-slate-200 dark:bg-slate-700 mb-4" />
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="h-12 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-12 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-12 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="h-20 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}

      {!isLoading &&
        questions.map((q, idx) => {
          const questionNumber = (pagination.currentPage - 1) * pagination.pageSize + idx + 1;

          return (
            <div key={`${q.text}-${questionNumber}`} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-colors">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500">Q{questionNumber}</span>
                    {q.difficulty === "Hard" && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">High Difficulty</span>}
                    {q.engagement === "Low" && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">Low Engagement</span>}
                  </div>
                  <h4 className="text-lg font-medium text-slate-800 dark:text-white">{q.text}</h4>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-slate-500 dark:text-slate-400 mb-1">Responses</p>
                    <p className="font-bold text-slate-800 dark:text-white">{q.responses} <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">/ {totalStudents}</span></p>
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
                  <span className="text-xs text-slate-500 dark:text-slate-400">{q.correctPct > 50 ? "Performing as expected" : "Requires attention"}</span>
                </div>
                <div className="w-full h-3 bg-red-100 dark:bg-red-900/30 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 dark:bg-emerald-400 h-full transition-all duration-500" style={{ width: `${q.correctPct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-500 mt-2">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          );
        })}

      {!isLoading && questions.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            No questions found for this room.
          </div>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 px-4">
          <PaginationControls
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            itemLabel="questions"
            onPageChange={setQuestionPage}
          />
        </div>
      )}
    </div>
  );
};
