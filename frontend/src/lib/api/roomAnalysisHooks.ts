import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "@/lib/api/api";
import type { Overview, PaginationMeta, QuestionStats, StudentStats } from "@/shared/types";

type RoomAnalysisQueryOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export const roomAnalysisKeys = {
  all: (roomId: string | undefined) => ["roomAnalysis", roomId] as const,
  overview: (roomId: string | undefined) => [...roomAnalysisKeys.all(roomId), "overview"] as const,
  achievements: (roomId: string | undefined) => [...roomAnalysisKeys.all(roomId), "achievements"] as const,
  students: (roomId: string | undefined, params: Record<string, unknown>) =>
    [...roomAnalysisKeys.all(roomId), "students", params] as const,
  questions: (roomId: string | undefined, params: Record<string, unknown>) =>
    [...roomAnalysisKeys.all(roomId), "questions", params] as const,
};

export function useRoomOverview(roomId: string | undefined, options?: RoomAnalysisQueryOptions) {
  return useQuery({
    queryKey: roomAnalysisKeys.overview(roomId),
    enabled: !!roomId && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 10_000,
    queryFn: async () => {
      const response = await api.get(`/livequizzes/rooms/${roomId}/analysis/overview`);
      const result = response.data;
      if (!result.success) throw new Error("Failed to get room overview");
      return (result.data.overview || result.data) as Overview;
    },
  });
}

export type AchievementData = {
  badges: { name: string; description: string; earned: number }[];
  students: { name: string; earnedBadges: string[] }[];
};

export function useRoomAchievements(roomId: string | undefined, options?: RoomAnalysisQueryOptions) {
  return useQuery({
    queryKey: roomAnalysisKeys.achievements(roomId),
    enabled: !!roomId && (options?.enabled ?? true),
    staleTime: options?.staleTime ?? 30_000,
    queryFn: async () => {
      const response = await api.get(`/livequizzes/rooms/${roomId}/analysis/achievements`);
      const result = response.data;
      if (!result.success) throw new Error("Failed to get achievements analysis");
      return (result.data.achievements || result.data) as AchievementData;
    },
  });
}

export function useRoomStudents<TParams extends Record<string, unknown>>(
  roomId: string | undefined,
  params: TParams,
  options?: RoomAnalysisQueryOptions,
) {
  return useQuery({
    queryKey: roomAnalysisKeys.students(roomId, params),
    enabled: !!roomId && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: options?.staleTime ?? 30_000,
    queryFn: async () => {
      const response = await api.get(`/livequizzes/rooms/${roomId}/analysis/students`, { params });
      const result = response.data;
      if (!result.success) throw new Error("Failed to get students analysis");

      const items = (result.data.items || result.data.dashboard?.students || []) as StudentStats[];
      const pagination = (result.data.pagination || result.data.dashboard?.pagination?.students) as
        | PaginationMeta
        | undefined;

      return { items, pagination };
    },
  });
}

export function useRoomQuestions<TParams extends Record<string, unknown>>(
  roomId: string | undefined,
  params: TParams,
  options?: RoomAnalysisQueryOptions,
) {
  return useQuery({
    queryKey: roomAnalysisKeys.questions(roomId, params),
    enabled: !!roomId && (options?.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: options?.staleTime ?? 30_000,
    queryFn: async () => {
      const response = await api.get(`/livequizzes/rooms/${roomId}/analysis/questions`, { params });
      const result = response.data;
      if (!result.success) throw new Error("Failed to get questions analysis");

      const items = (result.data.items || result.data.dashboard?.questions || []) as QuestionStats[];
      const pagination = (result.data.pagination || result.data.dashboard?.pagination?.questions) as
        | PaginationMeta
        | undefined;

      return { items, pagination };
    },
  });
}

