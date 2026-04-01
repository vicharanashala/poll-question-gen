import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { injectable } from 'inversify';
import { HttpError, InternalServerError } from 'routing-controllers';
import { questionSchemas } from '../schemas/index.js';
import { extractJSONFromMarkdown } from '../utils/extractJSONFromMarkdown.js';
import { cleanTranscriptLines } from '../utils/cleanTranscriptLines.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig } from '#root/config/ai.js';

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
  private readonly ollimaApiBaseUrl = `http://${aiConfig.serverIP}:${aiConfig.serverPort}/api`;
  private readonly llmApiUrl = `${this.ollimaApiBaseUrl}/generate`;
  
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
      timeout: 180000, // 3 min request timeout
    };
    
    try {
      const isLocal = this.ollimaApiBaseUrl.includes('localhost') || this.ollimaApiBaseUrl.includes('127.0.0.1');
      if (aiConfig.useProxy && !isLocal) {
        const proxyAgent = this.createProxyAgent();
        if (proxyAgent) {
          console.log(`[AIContentService] Using SOCKS proxy for connection to ${this.ollimaApiBaseUrl}`);
          config.httpAgent = proxyAgent;
          config.httpsAgent = proxyAgent;
        } else {
          console.warn(`[AIContentService] Failed to create proxy agent, falling back to direct connection`);
        }
      } else {
        console.log(`[AIContentService] Direct connection to ${this.ollimaApiBaseUrl} (proxy disabled)`);
      }
    } catch (error) {
      console.error(`[AIContentService] Error configuring request: ${error}`);
    }
    
    return config;
  }

  // --- Segmentation Logic ---
  public async segmentTranscript(
    transcript: string,
    model = 'llama3.2',
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
        model,
        prompt,
        stream: false,
        options: { temperature: 0.1 },
      }, config);

      const generatedText = response.data?.response;
      const cleaned = extractJSONFromMarkdown(generatedText);
      segments = JSON.parse(cleaned);

    } catch (error: any) {
      // Fallback segmentation logic remains the same
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

  // --- Question Generation Logic ---
  private createQuestionPrompt(
    questionType: string,
    count: number,
    transcriptContent: string
  ): string {
    return `You are an AI question generator. Generate EXACTLY ${count} question(s) of type ${questionType} based on the transcript.
Output ONLY a raw JSON array. No markdown, no conversational text.

Format:
[
  {
    "questionText": "Question here?",
    "options": [
      { "text": "Option A", "correct": true, "explanation": "Why correct" },
      { "text": "Option B", "correct": false, "explanation": "Why incorrect" },
      { "text": "Option C", "correct": false, "explanation": "Why incorrect" },
      { "text": "Option D", "correct": false, "explanation": "Why incorrect" }
    ],
    "solution": "Brief summary",
    "isParameterized": false,
    "timeLimitSeconds": 60,
    "points": 5
  }
]

Transcript:
${transcriptContent}`;
  }

  public async generateQuestions(args: {
    segments: Record<string | number, string>;
    globalQuestionSpecification: QuestionSpec[];
    model?: string;
  }): Promise<GeneratedQuestion[]> {
    const { segments, globalQuestionSpecification, model = 'llama3.2' } = args;

    if (!segments || Object.keys(segments).length === 0) {
      throw new HttpError(400, 'segments must be a non-empty object.');
    }

    const questionSpecs = globalQuestionSpecification[0];
    const allQuestions: GeneratedQuestion[] = [];

    for (const rawSegmentId in segments) {
      const segmentId = String(rawSegmentId);
      const transcript = segments[segmentId];
      if (!transcript) continue;

      for (const [type, count] of Object.entries(questionSpecs)) {
        if (typeof count === 'number' && count > 0) {
          try {
            const prompt = this.createQuestionPrompt(type, count, transcript);
            const config = this.getRequestConfig();
            
            const response = await axios.post(this.llmApiUrl, {
              model,
              prompt,
              stream: false,
              options: { temperature: 0.2 }
            }, config);
            
            const text = response.data?.response;
            if (typeof text !== 'string') continue;

            const cleaned = extractJSONFromMarkdown(text);
            const parsed = JSON.parse(cleaned);
            const rawQuestions = Array.isArray(parsed) ? parsed : [parsed];

            rawQuestions.forEach(q => {
              // --- ROBUST EXTRACTION LOGIC ---
              const questionText = q.questionText || q.question?.text || q.text || '';
              
              let finalOptions = [];
              if (Array.isArray(q.options)) {
                finalOptions = q.options;
              } else if (q.solution?.incorrectLotItems && q.solution?.correctLotItem) {
                // Handling Llama's common 'LotItem' nesting
                finalOptions = [
                  ...q.solution.incorrectLotItems.map((item: any) => ({
                    text: item.text,
                    correct: false,
                    explanation: item.explanation || item.explaination || ''
                  })),
                  {
                    text: q.solution.correctLotItem.text,
                    correct: true,
                    explanation: q.solution.correctLotItem.explanation || q.solution.correctLotItem.explaination || ''
                  }
                ];
              }

              allQuestions.push({
                questionText,
                options: finalOptions,
                solution: q.solution?.explanation || q.solution || '',
                isParameterized: q.isParameterized ?? q.question?.isParameterized ?? false,
                timeLimitSeconds: q.timeLimitSeconds ?? q.question?.timeLimitSeconds ?? 60,
                points: q.points ?? q.question?.points ?? 5,
                segmentId,
                questionType: type
              });
            });

            console.log(`[generateQuestions] Generated ${rawQuestions.length} ${type} questions.`);
          } catch (e: any) {
            console.error(`[generateQuestions] Error: ${e.message}`);
          }
        }
      }
    }

    return allQuestions;
  }
}