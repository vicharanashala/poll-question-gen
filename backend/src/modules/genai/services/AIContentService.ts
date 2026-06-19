import { injectable } from 'inversify';
import { HttpError, InternalServerError } from 'routing-controllers';
import { extractJSONFromMarkdown } from '../utils/extractJSONFromMarkdown.js';
import { cleanTranscriptLines } from '../utils/cleanTranscriptLines.js';
import { GoogleGenAI } from '@google/genai';

// --- Type Definitions ---
export interface TranscriptSegment {
  end_time: string;
  transcript_lines: string[];
}

export interface GeneratedQuestion {
  segmentId?: string;
  questionType?: string;
  questionText: string;
  options?: Array<{ text: string; correct?: boolean; explanation?: string }>;
  solution?: any;
  isParameterized?: boolean;
  timeLimitSeconds?: number;
  points?: number;
}

export type QuestionType = 'SOL' | 'SML' | 'OTL' | 'NAT' | 'DES';
export type QuestionSpec = Partial<Record<QuestionType, number>>;

@injectable()
export class AIContentService {
  // --- Segmentation Logic ---
  public async segmentTranscript(
    transcript: string,
    desiredSegments = 3
  ): Promise<Record<string, string>> {
    if (!transcript?.trim()) {
      throw new HttpError(400, 'Transcript text is required and must be non-empty.');
    }

    console.log(`[segmentTranscript] Processing transcript length: ${transcript.length} chars`);

    const lines = transcript.split('\n').filter(line => line.trim() !== '');
    const minLines = 8;
    let segments: TranscriptSegment[] = [];

    if (lines.length <= minLines) {
      const lastLine = lines[lines.length - 1] || '';
      const timeMatch = lastLine.match(/(\d{2}:\d{2}(?::\d{2})?\.\d{3})/g);
      const endTime = timeMatch && timeMatch.length > 0 ? timeMatch[timeMatch.length - 1] : '00:00.000';
      segments.push({
        end_time: endTime,
        transcript_lines: lines,
      });
      console.log(`[segmentTranscript] Small transcript detected. Created 1 segment with ${lines.length} lines.`);
    } else {
      const linesPerSegment = Math.max(minLines, Math.ceil(lines.length / desiredSegments));
      for (let i = 0; i < lines.length; i += linesPerSegment) {
        const segmentLines = lines.slice(i, i + linesPerSegment);
        const lastLine = segmentLines[segmentLines.length - 1] || '';
        const timeMatch = lastLine.match(/(\d{2}:\d{2}(?::\d{2})?\.\d{3})/g);
        const endTime = timeMatch && timeMatch.length > 0 ? timeMatch[timeMatch.length - 1] : `00:${String(i).padStart(2, '0')}.000`;
        segments.push({
          end_time: endTime,
          transcript_lines: segmentLines,
        });
      }
      console.log(`[segmentTranscript] Created ${segments.length} fallback segments.`);
    }

    const result: Record<string, string> = {};
    for (const seg of segments) {
      try {
        const clean = cleanTranscriptLines(seg.transcript_lines);
        if (clean?.trim()) {
          result[seg.end_time] = clean;
        }
      } catch (e) {
        console.warn(`[segmentTranscript] Failed cleaning segment ${seg.end_time}:`, e);
      }
    }

    console.log(`[segmentTranscript] Done. Returning ${Object.keys(result).length} segments.`);
    return result;
  }

  // --- Question Generation Logic ---
  private createQuestionPrompt(
    questionType: string,
    count: number,
    transcriptContent: string
  ): string {
    const base = `You are an AI question generator.
Based on the transcript below, generate EXACTLY ${count} question(s) of type ${questionType}.
For each question:
- Provide exactly 4 options only.
- Mark the correct option.

IMPORTANT: Generate exactly ${count} questions, no more, no less.

You must output JSON **exactly** in this shape, no nesting, no markdown:
[
  {
    "questionText": "...",
    "options": [
      { "text": "...", "correct": true, "explanation": "..." },
      { "text": "...", "correct": false, "explanation": "..." }
    ],
    "solution": "...",
    "isParameterized": false,
    "timeLimitSeconds": 60,
    "points": 5
  }
]

Transcript:
${transcriptContent}
`;

    const instructions: Record<string, string> = {
      SOL: `Generate ${count} single-correct MCQ as above. timeLimitSeconds:60, points:5`,
      SML: `Generate ${count} multiple-correct MCQ, 2-3 correct:true, timeLimitSeconds:90, points:8`,
      OTL: `Generate ${count} ordering question, with options in correct order, timeLimitSeconds:120, points:10`,
      NAT: `Generate ${count} numeric answer with value, timeLimitSeconds:90, points:6`,
      DES: `Generate ${count} descriptive answer, detailed solution, timeLimitSeconds:300, points:15`
    };

    return base + (instructions[questionType] || '');
  }

  public async generateQuestions(args: {
  segments: Record<string | number, string>;
  globalQuestionSpecification: QuestionSpec[];
  model?: string;
}): Promise<GeneratedQuestion[]> {
  const { segments, globalQuestionSpecification } = args;

  if (!segments || Object.keys(segments).length === 0) {
    throw new HttpError(400, 'segments must be a non-empty object.');
  }
  if (!globalQuestionSpecification?.length || !Object.keys(globalQuestionSpecification[0] || {}).length) {
    throw new HttpError(400, 'globalQuestionSpecification must be a non-empty array with at least one spec.');
  }

  const questionSpecs = globalQuestionSpecification[0];
  const allQuestions: GeneratedQuestion[] = [];

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  if (!geminiApiKey) {
    throw new InternalServerError('Gemini API key not configured.');
  }

  const genaiClient = new GoogleGenAI({ apiKey: geminiApiKey });

  for (const rawSegmentId in segments) {
    const segmentId = String(rawSegmentId);
    const transcript = segments[segmentId];
    if (!transcript) continue;

    for (const [type, count] of Object.entries(questionSpecs)) {
      if (typeof count === 'number' && count > 0) {
        try {
          const prompt = this.createQuestionPrompt(type, count, transcript);

          console.log(`[generateQuestions] Calling Gemini for ${type} questions, segment ${segmentId}`);
          const resp = await genaiClient.models.generateContent({
            model: geminiModel,
            contents: prompt, 
          });

          const rawText = typeof resp.text === "string"
            ? resp.text
            : JSON.stringify(resp.text);

          console.log(`[generateQuestions] Gemini raw preview for ${type}, seg ${segmentId}:`, rawText.slice(0, 300));

          const cleaned = extractJSONFromMarkdown(String(rawText));
          const parsed = JSON.parse(cleaned);
          const questions = Array.isArray(parsed) ? parsed : [parsed];

          questions.forEach((q: any) => {
            const options = (q.options || []).map((opt: any) => ({
              text: opt.text || opt.option || '',
              correct: !!opt.correct,
              explanation: opt.explanation || opt.explaination || ''
            }));
            allQuestions.push({
              questionText: q.questionText || q.question?.text || '',
              options,
              solution: q.solution || '',
              isParameterized: q.isParameterized ?? false,
              timeLimitSeconds: q.timeLimitSeconds ?? 60,
              points: q.points ?? 5,
              segmentId,
              questionType: type
            });
          });

          console.log(`[generateQuestions] Generated ${questions.length} ${type} questions for segment ${segmentId} via Gemini`);
        } catch (gemErr: any) {
          console.error(`[generateQuestions] Gemini call failed for ${type}, seg ${segmentId}:`, gemErr.message);
          throw new InternalServerError("Question generation failed. Please try again later.");
        }
      }
    }
  }

  console.log(`[generateQuestions] Done. Total questions: ${allQuestions.length}`);
  return allQuestions;
  }
}