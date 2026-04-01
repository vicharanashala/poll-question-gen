import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL;
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const handleApiError = (error: any, message: string) => {
  console.error(error);
  toast.error(message);
};

// --- New Types for Live Generation ---
export type LiveSegmentQuestionsInput = {
  transcript: string;
  questionSpecs: Record<string, number>;
  model?: string;
};

export type LiveSegmentQuestionsResponse = {
  success: boolean;
  questions: any[];
};

// --- Existing Types ---
type TranscriptResponse = { message: string; youtubeUrl: string; generatedTranscript: string; };
type TranscriptInput = { youtubeUrl: string };

// --- Hooks ---

export function useGenerateLiveSegmentQuestions(
  onSuccess: (data: any[]) => void,
  onError?: (error: any) => void
) {
  return useMutation<LiveSegmentQuestionsResponse, unknown, LiveSegmentQuestionsInput>({
    mutationFn: async (input) => {
      try {
        const response = await api.post<LiveSegmentQuestionsResponse>(
          "/genai/generate-live-segment",
          input
        );
        return response.data;
      } catch (error: any) {
        handleApiError(error, "Failed to generate live questions");
        throw error;
      }
    },
    onSuccess: (data) => onSuccess(data.questions),
    onError,
  });
}

export function useGenerateTranscript(
  onSuccess: (data: TranscriptResponse) => void,
  onError?: (error: any) => void
) {
  return useMutation<TranscriptResponse, unknown, FormData | TranscriptInput>({
    mutationFn: async (input) => {
      const isFormData = input instanceof FormData;
      const response = await api.post<TranscriptResponse>(
        "/genai/generate/transcript",
        input,
        {
          headers: {
            "Content-Type": isFormData ? "multipart/form-data" : "application/json",
          },
        }
      );
      return response.data;
    },
    onSuccess,
    onError,
  });
}

type SegmentResponse = {
  message: string;
  segments: Record<string, string>;
  segmentCount: number;
};

export function useSegmentTranscript(
  onSuccess: (segment: SegmentResponse) => void,
  onError?: (error: any) => void
) {
  return useMutation<SegmentResponse, unknown, { transcript: string }>({
    mutationFn: async ({ transcript }) => {
      const response = await api.post<SegmentResponse>("/genai/generate/transcript/segment", {
        transcript,
      });
      return response.data;
    },
    onSuccess,
    onError,
  });
}

type GenerateQuestionsInput = {
  segments: Record<string, string>;
  questionsPerSegment?: number;
  model?: string;
};
type GenerateQuestionsResponse = {
  message: string;
  totalQuestions: number;
  questions: string[];
};

export function useGenerateQuestions(
  onSuccess: (questions: string[]) => void,
  onError?: (error: any) => void
) {
  return useMutation<GenerateQuestionsResponse, unknown, GenerateQuestionsInput>({
    mutationFn: async ({segments, questionsPerSegment = 2, model }) => {
      try {
        const response = await api.post<GenerateQuestionsResponse>("/genai/generate/questions", {
          segments,
          globalQuestionSpecification: [{ count: questionsPerSegment }],
          model,
        });
        return response.data;
      } catch (error: any) {
        handleApiError(error, "Failed to generate questions");
        throw error;
      }
    },
    onSuccess: (data) => onSuccess(data.questions), // only pass questions to UI
    onError,
  });
}
