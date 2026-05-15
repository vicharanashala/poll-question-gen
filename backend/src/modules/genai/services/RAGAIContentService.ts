import axios, { AxiosRequestConfig } from 'axios';
import { injectable } from 'inversify';
import { extractJSONFromMarkdown } from '../utils/extractJSONFromMarkdown.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig } from '#root/config/ai.js';

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
export class RAGAIContentService {
  private readonly ollmaApiBaseUrl = `http://${aiConfig.serverIP}:${aiConfig.serverPort}/api`;

  // Models
  private readonly llmApiUrl = `${this.ollmaApiBaseUrl}/generate`;
  private readonly embedApiUrl = `${this.ollmaApiBaseUrl}/embeddings`;

  // Default models
  private readonly modelName = 'llama3.1';
  private readonly embeddingModel = 'mxbai-embed-large';

  // Pure JS Vector Store
  private vectors: number[][] = [];
  private vectorStore: string[] = [];

  // ---------- RAG LOGIC (OLLAMA POWERED) ----------

  private async getEmbedding(text: string): Promise<number[]> {
    const config = this.getRequestConfig();
    try {
      const response = await axios.post(
        this.embedApiUrl,
        {
          model: this.embeddingModel,
          prompt: text,
        },
        config
      );
      return response.data.embedding;
    } catch (error) {
      console.error(`[RAG] Embedding failed:`, error);
      return [];
    }
  }

  private async buildVectorStore(chunks: string[]) {
    this.vectorStore = chunks;
    this.vectors = [];

    const embeddingPromises = chunks.map((chunk) => this.getEmbedding(chunk));
    this.vectors = await Promise.all(embeddingPromises);
  }

  private cosineSimilarity(a: number[], b: number[]) {
    if (!a.length || !b.length) return 0;

    let dot = 0,
      normA = 0,
      normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private async retrieveRelevantContext(query: string, topK = 3): Promise<string> {
    if (!this.vectors.length) return '';

    const q = await this.getEmbedding(query);
    const scores = this.vectors.map((vec, idx) => ({
      idx,
      score: this.cosineSimilarity(q, vec),
    }));

    scores.sort((a, b) => b.score - a.score);
    const top = scores.slice(0, topK);

    return top.map((s) => this.vectorStore[s.idx]).join('\n');
  }

  // ---------- INFRASTRUCTURE ----------

  private createProxyAgent() {
    try {
      return new SocksProxyAgent('socks5://localhost:1055');
    } catch (error) {
      console.error(`Failed to create SOCKS proxy agent: ${error}`);
      return undefined;
    }
  }

  private getRequestConfig(): AxiosRequestConfig {
    const config: AxiosRequestConfig = { timeout: 180000 };

    try {
      const isLocal =
        this.ollmaApiBaseUrl.includes('localhost') ||
        this.ollmaApiBaseUrl.includes('127.0.0.1');

      if (aiConfig.useProxy && !isLocal) {
        const proxyAgent = this.createProxyAgent();
        if (proxyAgent) {
          config.httpAgent = proxyAgent;
          config.httpsAgent = proxyAgent;
        }
      }
    } catch (error) {
      console.error(`[AIContentService] Error configuring request: ${error}`);
    }

    return config;
  }

  private createQuestionPrompt(
  questionType: string,
  count: number,
  transcriptContent: string,
  retrievedContext: string
): string {
  const base = `You are an AI question generator.

  Use the following retrieved context to ensure technical accuracy:
  ${retrievedContext}

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
  Do not wrap questionText inside another 'question' object. Output must be raw JSON.

  Important:
  - Output only JSON, no markdown, no extra text.
  - Each question must have at least 4 options.
  - Only one option can have "correct": true for SOL.
  - Fill all fields.
  - questionText must be clear and relevant to transcript.
  - explanation field must explain why the option is correct/incorrect.
  - Generate EXACTLY ${count} questions.

  Transcript:
  ${transcriptContent}

  `;

    const instructions: Record<string, string> = {
      SOL: `Generate ${count} single-correct MCQ with exactly 4 options and only 1 correct option.`,
      SML: `Generate ${count} multiple-correct MCQ with exactly 4 options and 2-3 correct options.`,
      OTL: `Generate ${count} ordering questions with options arranged for sequencing.`,
      NAT: `Generate ${count} numeric answer questions. No MCQ unless explicitly needed.`,
      DES: `Generate ${count} descriptive questions with a detailed solution field.`,
    };

    return base + '\n' + (instructions[questionType] || '');
  }

  private safeParseQuestions(text: string): any {
    let cleaned = extractJSONFromMarkdown(text).trim();

    // 1) Try direct parse first
    try {
      return JSON.parse(cleaned);
    } catch {
      // continue to robust extraction
    }

    // 2) Extract first valid balanced JSON array/object from the text
    const extractBalancedJson = (input: string): string | null => {
      const startCandidates = ['[', '{'];

      for (const startChar of startCandidates) {
        const start = input.indexOf(startChar);
        if (start === -1) continue;

        const stack: string[] = [];
        let inString = false;
        let escaped = false;

        for (let i = start; i < input.length; i++) {
          const ch = input[i];

          if (escaped) {
            escaped = false;
            continue;
          }

          if (ch === '\\') {
            escaped = true;
            continue;
          }

          if (ch === '"') {
            inString = !inString;
            continue;
          }

          if (inString) continue;

          if (ch === '{' || ch === '[') {
            stack.push(ch);
          } else if (ch === '}' || ch === ']') {
            const last = stack[stack.length - 1];

            if (
              (ch === '}' && last === '{') ||
              (ch === ']' && last === '[')
            ) {
              stack.pop();

              if (stack.length === 0) {
                return input.slice(start, i + 1);
              }
            }
          }
        }
      }

      return null;
    };

    const extracted = extractBalancedJson(cleaned);

    if (!extracted) {
      throw new SyntaxError('Could not extract a valid JSON array/object from model output.');
    }

    return JSON.parse(extracted);
  }

  private normalizeQuestion(q: any, questionType: string, segmentId: string): GeneratedQuestion | null {
    // Case 1: model returned plain string like "Functional"
    if (typeof q === 'string') {
      return {
        questionText: q,
        segmentId,
        questionType,
      };
    }

    // Case 2: object
    if (q && typeof q === 'object' && !Array.isArray(q)) {
      const questionText =
        typeof q.questionText === 'string'
          ? q.questionText
          : typeof q.question === 'string'
          ? q.question
          : typeof q.text === 'string'
          ? q.text
          : null;

      if (!questionText) {
        return null;
      }

      return {
        ...q,
        questionText,
        segmentId,
        questionType,
      };
    }

    return null;
  }

  // ---------- MAIN ENTRY POINT ----------

  public async generateQuestions(args: {
    segments: Record<string | number, string>;
    globalQuestionSpecification: QuestionSpec[];
    model?: string;
  }): Promise<GeneratedQuestion[]> {
    const { segments, globalQuestionSpecification, model } = args;
    const questionSpecs = globalQuestionSpecification[0];
    const allQuestions: GeneratedQuestion[] = [];

    // BUILD VECTOR STORE ONCE using all segments as knowledge base
    const allChunks = Object.values(segments);
    await this.buildVectorStore(allChunks);

    for (const rawSegmentId in segments) {
      const segmentId = String(rawSegmentId);
      const transcript = segments[segmentId];
      if (!transcript) continue;

      for (const [type, count] of Object.entries(questionSpecs)) {
        if (typeof count === 'number' && count > 0) {
          try {
            const retrievedContext = await this.retrieveRelevantContext(transcript);

            const prompt = this.createQuestionPrompt(
              type,
              count,
              transcript,
              retrievedContext
            );

            const config = this.getRequestConfig();
            const response = await axios.post(
              this.llmApiUrl,
              {
                model: model ?? this.modelName,
                prompt,
                stream: false,
                options: { temperature: 0.2 },
              },
              config
            );

            const text = response.data?.response;
            if (typeof text !== 'string' || !text.trim()) continue;

            // Debug 
            console.log(`[RAG DEBUG] Raw model output for segment ${segmentId}:`, text);

            const parsed = this.safeParseQuestions(text);
            const questions = Array.isArray(parsed) ? parsed : [parsed];

            for (const q of questions) {
              const normalized = this.normalizeQuestion(q, type, segmentId);
              if (normalized) {
                allQuestions.push(normalized);
              }
            }
          } catch (e: any) {
            if (axios.isAxiosError(e)) {
              console.error(`[generateQuestions] Failed for segment ${segmentId}`);
              console.error('Status:', e.response?.status);
              console.error('Response data:', e.response?.data);
              console.error('Request URL:', e.config?.url);
              console.error('Method:', e.config?.method);
            } else {
              console.error(`[generateQuestions] Failed for segment ${segmentId}:`, e);
            }
          }
        }
      }
    }

    return allQuestions;
  }
}