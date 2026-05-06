import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { injectable } from 'inversify';
import { HttpError, InternalServerError } from 'routing-controllers';
import { questionSchemas } from '../schemas/index.js';
import { extractJSONFromMarkdown } from '../utils/extractJSONFromMarkdown.js';
import { cleanTranscriptLines } from '../utils/cleanTranscriptLines.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig } from '#root/config/ai.js';

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
  private readonly ollimaApiBaseUrl = `http://127.0.0.1:11434/api`;
  private readonly llmApiUrl = `${this.ollimaApiBaseUrl}/generate`;
  private readonly DEFAULT_MODEL = "llama3.2:latest";
  
  private createProxyAgent() {
    try {
      return new SocksProxyAgent('socks5://localhost:1055');
    } catch (error) {
      console.error(`Failed to create SOCKS proxy agent: ${error}`);
      return undefined;
    }
  }
  
  private getRequestConfig(): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      // Bumping to 15 mins to ensure 20-question batches don't timeout
      timeout: 900000, 
    };
    
    try {
      const isLocal = this.ollimaApiBaseUrl.includes('localhost') || this.ollimaApiBaseUrl.includes('127.0.0.1');
      if (aiConfig.useProxy && !isLocal) {
        const proxyAgent = this.createProxyAgent();
        if (proxyAgent) {
          config.httpAgent = proxyAgent;
          config.httpsAgent = proxyAgent;
        } else {
          console.warn(`[AIContentService] Failed to create proxy agent, falling back to direct connection`);
        }
      }
    } catch (error) {
      console.error(`[AIContentService] Error configuring request: ${error}`);
    }
    
    return config;
  }

  public async segmentTranscript(
    transcript: string,
    model = this.DEFAULT_MODEL,
    desiredSegments = 3
  ): Promise<Record<string, string>> {
    if (!transcript?.trim()) {
      throw new HttpError(400, 'Transcript text is required and must be non-empty.');
    }

    const prompt = `Analyze the following timed lecture transcript. Segment into meaningful subtopics (max ${desiredSegments} segments).
Format: each line as [start_time --> end_time] text.
Response must be ONLY valid JSON array.
Use property name "transcript_lines" exactly.

Transcript:
${transcript}

JSON:`;

    let segments: TranscriptSegment[] = [];

    try {
      const config = this.getRequestConfig();
      const response = await axios.post(this.llmApiUrl, {
        model: this.DEFAULT_MODEL,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
      }, config);

      const generatedText = response.data?.response;
      const cleaned = extractJSONFromMarkdown(generatedText);
      segments = JSON.parse(cleaned);

    } catch (error: any) {
      const lines = transcript.split('\n').filter(line => line.trim() !== '');
      segments = [{ end_time: '00:00.000', transcript_lines: lines }];
    }

    const result: Record<string, string> = {};
    for (const seg of segments) {
      const clean = cleanTranscriptLines(seg.transcript_lines);
      if (clean?.trim()) {
        result[seg.end_time] = clean;
      }
    }
    return result;
  }

  private createQuestionPrompt(
    questionType: string,
    count: number,
    transcriptContent: string
  ): string {
    return `You are an expert educational assessment generator. Your task is to generate EXACTLY ${count} unique, high-quality questions of type ${questionType} based STRICTLY on the provided transcript.

CRITICAL INSTRUCTIONS:
1. QUANTITY: You MUST generate exactly ${count} objects inside the "questions" array. Do not stop until you reach this number.
2. NO PLACEHOLDERS: You are forbidden from using "Option A/B" or True/False placeholders. Options must be educational phrases.
3. FULL QUESTIONS: 'questionText' must be a complete interrogative sentence ending in a question mark.
4. STRICT JSON ONLY: Return a valid JSON object with the key "questions".

Format Pattern:
{
  "questions": [
    {
      "questionText": "<Question 1 text?>",
      "options": [
        { "text": "<Correct answer>", "correct": true, "explanation": "<Why correct>" },
        { "text": "<Distractor 1>", "correct": false, "explanation": "<Why wrong>" },
        { "text": "<Distractor 2>", "correct": false, "explanation": "<Why wrong>" },
        { "text": "<Distractor 3>", "correct": false, "explanation": "<Why wrong>" }
      ],
      "solution": "<Concept summary>",
      "isParameterized": false,
      "timeLimitSeconds": 60,
      "points": 5
    }
    // ... CONTINUE GENERATING UNTIL THE ARRAY HAS EXACTLY ${count} OBJECTS ...
  ]
}

Transcript:
${transcriptContent}`;
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

    const questionSpecs = globalQuestionSpecification[0];
    const allQuestions: GeneratedQuestion[] = [];

    for (const rawSegmentId in segments) {
      const segmentId = String(rawSegmentId);
      const transcript = segments[segmentId];
      
      if (!transcript || transcript.trim().length < 150) {
        console.warn(`[generateQuestions] Segment ${segmentId} too short. Skipping.`);
        continue;
      }

      for (const [type, count] of Object.entries(questionSpecs)) {
        if (typeof count === 'number' && count > 0) {
          try {
            const prompt = this.createQuestionPrompt(type, count, transcript);
            const config = this.getRequestConfig();
            
            console.log(`[generateQuestions] Requesting ${count} questions...`);
            
            const response = await axios.post(this.llmApiUrl, {
              model: this.DEFAULT_MODEL, 
              prompt,
              stream: false,
              format: "json", 
              options: { 
                temperature: 0.3,
                num_predict: 8192, // High token limit for large batches
                num_ctx: 16384     // Large context window
              }
            }, config);
            
            const text = response.data?.response;
            if (typeof text !== 'string') continue;

            let parsed;
            try {
              parsed = JSON.parse(text); 
            } catch {
              try {
                const cleaned = extractJSONFromMarkdown(text);
                parsed = JSON.parse(cleaned);
              } catch (parseErr) {
                const fixedStr = text.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
                try {
                  parsed = JSON.parse(extractJSONFromMarkdown(fixedStr));
                } catch (fallbackErr) {
                  console.error("[generateQuestions] JSON Parse Error.");
                  continue; 
                }
              }
            }

            let rawQuestions: any[] = [];
            
            // SMARTER JSON PARSING
            if (Array.isArray(parsed)) {
              rawQuestions = parsed;
            } else if (parsed && typeof parsed === 'object') {
              if (parsed.questions && Array.isArray(parsed.questions)) {
                rawQuestions = parsed.questions;
              } else if (parsed.questionText || parsed.question || parsed.options) {
                rawQuestions = [parsed];
              } else if (parsed.data && Array.isArray(parsed.data)) {
                rawQuestions = parsed.data;
              } else {
                const arrayValues = Object.values(parsed).filter(v => Array.isArray(v));
                if (arrayValues.length > 0 && arrayValues[0].length > 0 && 
                   (arrayValues[0][0].questionText || arrayValues[0][0].question)) {
                  rawQuestions = arrayValues[0] as any[];
                } else {
                  rawQuestions = [parsed];
                }
              }
            }

            rawQuestions.forEach(q => {
              const qObj = q || {};
              const questionText = qObj.questionText || qObj.QuestionText || qObj.question || qObj.Question || qObj.text || '';
              const solution = qObj.solution || qObj.Solution || qObj.explanation || '';
              const isParameterized = qObj.isParameterized ?? qObj.IsParameterized ?? qObj.question?.isParameterized ?? false;
              const timeLimitSeconds = qObj.timeLimitSeconds ?? qObj.TimeLimitSeconds ?? 60;
              const points = qObj.points ?? qObj.Points ?? 5;
              
              let finalOptions: any[] = [];
              const rawOptions = qObj.options || qObj.Options || qObj.choices || qObj.Choices || qObj.answers || [];
              
              if (Array.isArray(rawOptions) && rawOptions.length > 0) {
                finalOptions = rawOptions.map(opt => {
                  if (typeof opt === 'string') return { text: opt, correct: false, explanation: "" };
                  return {
                    text: opt.text || opt.Text || opt.value || opt.choice || opt.option || String(opt),
                    correct: opt.correct === true || opt.Correct === true || opt.isCorrect === true || String(opt.correct).toLowerCase() === 'true',
                    explanation: opt.explanation || opt.Explanation || opt.reason || ''
                  };
                });
              } else if (typeof rawOptions === 'object' && Object.keys(rawOptions).length > 0) {
                finalOptions = Object.values(rawOptions).map((opt: any) => {
                  if (typeof opt === 'string') return { text: opt, correct: false, explanation: "" };
                  return {
                    text: opt.text || opt.Text || String(opt),
                    correct: opt.correct === true || opt.Correct === true,
                    explanation: opt.explanation || opt.Explanation || ''
                  };
                });
              } else if (qObj.solution?.incorrectLotItems && qObj.solution?.correctLotItem) {
                // Handling your specific fallback case
                finalOptions = [
                  ...qObj.solution.incorrectLotItems.map((item: any) => ({
                    text: item.text,
                    correct: false,
                    explanation: item.explanation || item.explaination || ''
                  })),
                  {
                    text: qObj.solution.correctLotItem.text,
                    correct: true,
                    explanation: qObj.solution.correctLotItem.explanation || qObj.solution.correctLotItem.explaination || ''
                  }
                ];
              }

              // Guardrails
              const isFragment = questionText.split(' ').length < 3;
              const hasLazyOptions = finalOptions.some(opt => /^option\s*[a-d1-4]$/i.test(opt.text));
              const missingCorrect = !finalOptions.some(opt => opt.correct === true);

              if (isFragment || hasLazyOptions || finalOptions.length < 2 || missingCorrect) {
                 console.warn(`[generateQuestions] Rejected low-quality generation: "${questionText.substring(0, 20)}..."`);
                 return; 
              }

              allQuestions.push({
                questionText,
                options: finalOptions,
                solution,
                isParameterized,
                timeLimitSeconds,
                points,
                segmentId,
                questionType: type
              });
            });

            console.log(`[generateQuestions] Parsed ${allQuestions.length} valid questions so far.`);
          } catch (e: any) {
            console.error("[generateQuestions] Request Error:", e.message);
          }
        }
      }
    }

    return allQuestions;
  }
}