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
  //private readonly ollimaApiBaseUrl = 'http://localhost:11434/api';
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
      timeout: 600000, // 10 min request timeout for slow local models
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
    model = 'gemma3',
    desiredSegments = 3 // <-- make fallback segments configurable
  ): Promise<Record<string, string>> {
    if (!transcript?.trim()) {
      throw new HttpError(400, 'Transcript text is required and must be non-empty.');
    }

    console.log(`[segmentTranscript] Processing transcript length: ${transcript.length} chars, model: ${model}`);

    const prompt = `Analyze the following timed lecture transcript. Segment into meaningful subtopics (max ${desiredSegments} segments).
Format: each line as [start_time --> end_time] text OR start_time --> end_time text.
Response must be ONLY valid JSON array, no markdown, no explanation, no comments.
Use property name "transcript_lines" exactly.

Example:
[
  {
    "end_time": "01:30.000",
    "transcript_lines": ["00:00.000 --> 00:30.000 Text", "00:30.000 --> 01:30.000 More text"]
  }
]

Transcript:
${transcript}

JSON:`;

    let segments: TranscriptSegment[] = [];

    try {
      console.log(`[segmentTranscript] Connecting to Ollama API at ${this.llmApiUrl} with model ${model}`);
      const config = this.getRequestConfig();
      
      const response = await axios.post(this.llmApiUrl, {
        model,
        prompt,
        stream: false,
        options: { temperature: 0.1, top_p: 0.9 },
      }, config);

      const generatedText = response.data?.response;
      if (typeof generatedText !== 'string') {
        throw new InternalServerError('Unexpected Ollima response format.');
      }

      console.log('[segmentTranscript] Response preview:', generatedText.slice(0, 300));

      let jsonToParse = '';
      try {
        const cleaned = extractJSONFromMarkdown(generatedText);
        const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
        jsonToParse = arrayMatch ? arrayMatch[0] : cleaned;

        const fixedJson = jsonToParse
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/}\s*{/g, '},{')
          .replace(/]\s*\[/g, '],[')
          .replace(/\s+/g, ' ')
          .trim();

        console.log('[segmentTranscript] Attempting to parse JSON...');
        segments = JSON.parse(fixedJson);

        if (!Array.isArray(segments) || segments.length === 0) {
          throw new Error('Parsed segments invalid or empty.');
        }

        segments.forEach((seg, idx) => {
          if (!seg.end_time || !Array.isArray(seg.transcript_lines)) {
            throw new Error(`Invalid segment at index ${idx}`);
          }
        });

        console.log(`[segmentTranscript] Successfully parsed ${segments.length} segments.`);
      } catch (parseError: any) {
        console.error('[segmentTranscript] JSON parse failed:', parseError.message);
        console.error('[segmentTranscript] Raw text preview:', generatedText.slice(0, 200));

        // Fallback segmentation
        console.log('[segmentTranscript] Using fallback segmentation...');
        const lines = transcript.split('\n').filter(line => line.trim() !== '');
        const desiredSegments = 3;
        const minLines = 8;
        segments = [];
        if (lines.length <= minLines) {
          // Transcript is very small → single segment
          const lastLine = lines[lines.length - 1] || '';
          const timeMatch = lastLine.match(/(\d{2}:\d{2}(?::\d{2})?\.\d{3})/g);
          const endTime = timeMatch && timeMatch.length > 0 ? timeMatch[timeMatch.length - 1] : '00:00.000';
          segments.push({
            end_time: endTime,
            transcript_lines: lines,
          });
          console.log(`[segmentTranscript] Small transcript detected. Created 1 segment with ${lines.length} lines.`);
        } else {
          // Larger transcript → split into segments with minLines
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
      }
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error('[segmentTranscript] Ollama API error:', error.message);
        console.error('[segmentTranscript] Error details:', {
          code: error.code,
          // Access network error details safely
          networkError: (error as any).cause,
          config: error.config ? {
            url: error.config.url,
            method: error.config.method,
            timeout: error.config.timeout,
            hasProxy: !!(error.config.httpAgent || error.config.httpsAgent)
          } : 'No config'
        });
        
        if (error.code === 'ETIMEDOUT') {
          throw new InternalServerError(`Connection to Ollama server timed out. Please check network connectivity and Tailscale status.`);
        } else if (error.code === 'ECONNREFUSED') {
          throw new InternalServerError(`Connection to Ollama server refused. Server may be down or unreachable.`);
        } else {
          throw new InternalServerError(`Ollama API error: ${(error.response?.data as any)?.error || error.message}`);
        }
      }
      throw new InternalServerError(`Segmentation failed: ${error.message}`);
    }

    // Clean transcript lines and build final object
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

You must output JSON **exactly** in this shape, matching this exact schema:
[
  {
    "question": {
      "text": "...",
      "type": "SELECT_ONE_IN_LOT",
      "isParameterized": false,
      "timeLimitSeconds": 60,
      "points": 5
    },
    "solution": {
      "incorrectLotItems": [
        { "text": "...", "explaination": "..." },
        { "text": "...", "explaination": "..." },
        { "text": "...", "explaination": "..." }
      ],
      "correctLotItem": {
        "text": "...",
        "explaination": "..."
      }
    }
  }
]
Output must be a raw JSON array. Do not wrap it in any other objects.

Important:
- Output only JSON, no markdown, no extra text.
- Each question must have exactly 4 options (1 correct, 3 incorrect).
- Fill all fields.
- question.text must be clear and relevant to transcript.
- explaination field must explain why the option is correct/incorrect.
- Generate EXACTLY ${count} questions.

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
    const { segments, globalQuestionSpecification, model = 'gemma3' } = args;

    if (!segments || Object.keys(segments).length === 0) {
      throw new HttpError(400, 'segments must be a non-empty object.');
    }
    if (!globalQuestionSpecification?.length || !Object.keys(globalQuestionSpecification[0] || {}).length) {
      throw new HttpError(400, 'globalQuestionSpecification must be a non-empty array with at least one spec.');
    }



    const questionSpecs = globalQuestionSpecification[0];
    const allQuestions: GeneratedQuestion[] = [];
    console.log(`[generateQuestions] Model: ${model}`);

    for (const rawSegmentId in segments) {
      const segmentId = String(rawSegmentId); // normalize
      const transcript = segments[segmentId];
      if (!transcript) continue;

      for (const [type, count] of Object.entries(questionSpecs)) {
        if (typeof count === 'number' && count > 0) {
          try {
            const schema = (questionSchemas as any)[type];
            if (!schema) console.warn(`[generateQuestions] No schema for type ${type}.`);

            const format = count === 1 ? schema : { type: 'array', items: schema, minItems: count, maxItems: count };
            const prompt = this.createQuestionPrompt(type, count, transcript);

            console.log(`[generateQuestions] Connecting to Ollama API at ${this.llmApiUrl} with model ${model} for ${type} questions`);
            const config = this.getRequestConfig();
            
            const response = await axios.post(this.llmApiUrl, {
              model,
              prompt,
              stream: false,
              format: schema ? format : undefined,
              options: { temperature: 0.2 }
            }, config);
            
            console.log(`[generateQuestions] Successfully received response for ${type} questions`);

            const text = response.data?.response;
            if (typeof text !== 'string') {
              console.warn(`[generateQuestions] Unexpected response for type ${type}, segment ${segmentId}.`);
              continue;
            }

            const cleaned = extractJSONFromMarkdown(text);
            const parsed = JSON.parse(cleaned);
            const questions = Array.isArray(parsed) ? parsed : [parsed];

            questions.forEach(q => {
              let questionText = q.question?.text || q.questionText || '';
              let options: any[] = [];
              // Extract options
              if (q.solution?.incorrectLotItems) {
                options = q.solution.incorrectLotItems.map((item: any) => ({
                  text: item.text,
                  correct: false,
                  explanation: item.explaination || item.explanation || ''
                }));
              }
              if (q.solution?.correctLotItem) {
                options.push({
                  text: q.solution.correctLotItem.text,
                  correct: true,
                  explanation: q.solution.correctLotItem.explaination || q.solution.correctLotItem.explanation || ''
                });
              }
              
              // Fallback for flat array of options if generated by LLM
              if (options.length === 0 && Array.isArray(q.options)) {
                options = q.options.map((o: any) => ({
                  text: o.text || '',
                  correct: o.correct === true,
                  explanation: o.explanation || o.explaination || ''
                }));
              }

              allQuestions.push({
                questionText,
                options,
                solution: '', // Optional: create from q.solution or leave empty
                isParameterized: q.question?.isParameterized ?? false,
                timeLimitSeconds: q.question?.timeLimitSeconds ?? 60,
                points: q.question?.points ?? 5,
                segmentId,
                questionType: type
              });
            });
            console.log(`[generateQuestions] Generated ${questions.length} ${type} questions for segment ${segmentId}`);
            console.log(`[generateQuestions] Raw LLM text for type ${type}, segment ${segmentId}:`, text.slice(0, 500));
          } catch (e: any) {
            console.error(`[generateQuestions] Failed for type ${type}, segment ${segmentId}:`, e.message);
            if (axios.isAxiosError(e)) {
              console.error('[generateQuestions] Ollama API error details:', {
                code: e.code,
                // Access network error details safely
                networkError: (e as any).cause,
                config: e.config ? {
                  url: e.config.url,
                  method: e.config.method,
                  timeout: e.config.timeout,
                  hasProxy: !!(e.config.httpAgent || e.config.httpsAgent)
                } : 'No config'
              });
              
              if (e.code === 'ETIMEDOUT') {
                throw new HttpError(500, `Connection to Ollama server timed out. Please check network connectivity and Tailscale status.`);
              } else if (e.code === 'ECONNREFUSED' || e.message.includes('ECONNREFUSED') || e.code === 'ENOTFOUND') {
                throw new HttpError(500, `Connection to Ollama server refused. Is Ollama running locally on port 11434?`);
              }
            }
            throw new HttpError(500, `AI Generation Error: ${e.response?.data?.error || e.message}`);
          }
        }
      }
    }

    console.log(`[generateQuestions] Done. Total questions: ${allQuestions.length}`);
    return allQuestions;
  }
}
