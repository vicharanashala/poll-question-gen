import axios, { AxiosRequestConfig } from 'axios';
import { injectable } from 'inversify';
import { HttpError, InternalServerError } from 'routing-controllers';
import { questionSchemas } from '../schemas/index.js';
import { extractJSONFromMarkdown } from '../utils/extractJSONFromMarkdown.js';
import { cleanTranscriptLines } from '../utils/cleanTranscriptLines.js';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { aiConfig, type AIProvider } from '#root/config/ai.js';

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
  private readonly ollamaApiBaseUrl = `http://${aiConfig.serverIP}:${aiConfig.serverPort}/api`;
  private readonly ollamaGenerateUrl = `${this.ollamaApiBaseUrl}/generate`;

  private get provider(): AIProvider {
    return aiConfig.provider;
  }

  private resolveModel(requestedModel?: string): string {
    const requested = (requestedModel || '').trim();

    if (this.provider === 'openrouter') {
      if (!requested || requested === aiConfig.mvpDummyModelToken || requested.toLowerCase().includes('dummy')) {
        return aiConfig.openRouterModel;
      }
      return requested;
    }

    if (!requested || requested === aiConfig.mvpDummyModelToken || requested.toLowerCase().includes('dummy')) {
      return aiConfig.ollamaDefaultModel;
    }

    return requested;
  }

  private createProxyAgent() {
    try {
      return new SocksProxyAgent(aiConfig.proxyAddress);
    } catch (error) {
      console.error(`Failed to create SOCKS proxy agent: ${error}`);
      return undefined;
    }
  }

  private getRequestConfig(provider: AIProvider): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      timeout: 180000, // 3 min request timeout
    };

    if (provider === 'openrouter') {
      if (!aiConfig.openRouterApiKey) {
        throw new InternalServerError('OPENROUTER_API_KEY is not configured on the backend.');
      }

      config.headers = {
        Authorization: `Bearer ${aiConfig.openRouterApiKey}`,
        'Content-Type': 'application/json',
      };

      if (aiConfig.openRouterReferer) {
        (config.headers as Record<string, string>)['HTTP-Referer'] = aiConfig.openRouterReferer;
      }
      if (aiConfig.openRouterAppName) {
        (config.headers as Record<string, string>)['X-Title'] = aiConfig.openRouterAppName;
      }

      return config;
    }

    try {
      const isLocal = this.ollamaApiBaseUrl.includes('localhost') || this.ollamaApiBaseUrl.includes('127.0.0.1');
      if (aiConfig.useProxy && !isLocal) {
        const proxyAgent = this.createProxyAgent();
        if (proxyAgent) {
          console.log(`[AIContentService] Using SOCKS proxy for connection to ${this.ollamaApiBaseUrl}`);
          config.httpAgent = proxyAgent;
          config.httpsAgent = proxyAgent;
        } else {
          console.warn(`[AIContentService] Failed to create proxy agent, falling back to direct connection`);
        }
      } else {
        console.log(`[AIContentService] Direct connection to ${this.ollamaApiBaseUrl} (proxy disabled)`);
      }
    } catch (error) {
      console.error(`[AIContentService] Error configuring request: ${error}`);
    }

    return config;
  }

  private extractOpenRouterText(data: any): string {
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
      return content.trim();
    }

    if (Array.isArray(content)) {
      const merged = content.map((part: any) => {
        if (typeof part === 'string') {
          return part;
        }
        if (typeof part?.text === 'string') {
          return part.text;
        }
        return '';
      }).join('');

      return merged.trim();
    }

    return '';
  }

  private extractApiErrorMessage(data: any): string {
    if (!data) {
      return '';
    }
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data?.error === 'string') {
      return data.error;
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
    if (typeof data?.error?.message === 'string') {
      return data.error.message;
    }

    try {
      return JSON.stringify(data);
    } catch {
      return '';
    }
  }

  private throwProviderError(context: string, provider: AIProvider, error: any): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const apiError = this.extractApiErrorMessage(error.response?.data);

      console.error(`[${context}] ${provider} error:`, {
        status,
        code: error.code,
        message: error.message,
        apiError,
      });

      if (provider === 'openrouter') {
        if (status === 401 || status === 403) {
          throw new InternalServerError('OpenRouter authentication failed. Check OPENROUTER_API_KEY.');
        }
        if (status === 429) {
          throw new InternalServerError('OpenRouter rate limit exceeded. Please retry in a moment.');
        }
        if (error.code === 'ETIMEDOUT') {
          throw new InternalServerError('OpenRouter request timed out. Try again or use a shorter transcript.');
        }
        throw new InternalServerError(`OpenRouter API error: ${apiError || error.message}`);
      }

      if (error.code === 'ETIMEDOUT') {
        throw new InternalServerError('Connection to Ollama server timed out. Please check connectivity.');
      }
      if (error.code === 'ECONNREFUSED') {
        throw new InternalServerError('Connection to Ollama server refused. Server may be down.');
      }
      throw new InternalServerError(`Ollama API error: ${apiError || error.message}`);
    }

    throw new InternalServerError(`${context} failed: ${error.message || 'Unknown error'}`);
  }

  private async requestLLMCompletion(args: {
    context: string;
    prompt: string;
    model?: string;
    temperature: number;
    format?: unknown;
  }): Promise<string> {
    const provider = this.provider;
    const resolvedModel = this.resolveModel(args.model);
    const config = this.getRequestConfig(provider);

    try {
      if (provider === 'openrouter') {
        console.log(`[${args.context}] Calling OpenRouter with model ${resolvedModel}`);
        const response = await axios.post(
          aiConfig.openRouterBaseUrl,
          {
            model: resolvedModel,
            messages: [
              { role: 'system', content: 'You are a precise quiz-generation assistant. Follow output format exactly.' },
              { role: 'user', content: args.prompt },
            ],
            temperature: args.temperature,
          },
          config,
        );

        const text = this.extractOpenRouterText(response.data);
        if (!text) {
          throw new InternalServerError('OpenRouter returned an empty response.');
        }
        return text;
      }

      console.log(`[${args.context}] Calling Ollama with model ${resolvedModel}`);
      const response = await axios.post(
        this.ollamaGenerateUrl,
        {
          model: resolvedModel,
          prompt: args.prompt,
          stream: false,
          format: args.format,
          options: { temperature: args.temperature, top_p: 0.9 },
        },
        config,
      );

      const text = response.data?.response;
      if (typeof text !== 'string') {
        throw new InternalServerError('Unexpected Ollama response format.');
      }

      return text;
    } catch (error: any) {
      this.throwProviderError(args.context, provider, error);
    }
  }

  // --- Segmentation Logic ---
  public async segmentTranscript(
    transcript: string,
    model = aiConfig.mvpDummyModelToken,
    desiredSegments = 3 // <-- make fallback segments configurable
  ): Promise<Record<string, string>> {
    if (!transcript?.trim()) {
      throw new HttpError(400, 'Transcript text is required and must be non-empty.');
    }

    const resolvedModel = this.resolveModel(model);
    console.log(`[segmentTranscript] Provider: ${this.provider}, transcript length: ${transcript.length}, requested model: ${model}, resolved model: ${resolvedModel}`);

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
      const generatedText = await this.requestLLMCompletion({
        context: 'segmentTranscript',
        prompt,
        model,
        temperature: 0.1,
      });

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
      if (error instanceof HttpError) {
        throw error;
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

  private normalizeQuestion(raw: any, segmentId: string, questionType: string): GeneratedQuestion | null {
    const questionText = typeof raw?.questionText === 'string'
      ? raw.questionText
      : typeof raw?.question?.text === 'string'
        ? raw.question.text
        : typeof raw?.question === 'string'
          ? raw.question
          : '';

    if (!questionText.trim()) {
      return null;
    }

    let options: Array<{ text: string; correct?: boolean; explanation?: string }> = [];

    if (Array.isArray(raw?.options)) {
      options = raw.options
        .map((opt: any) => {
          if (typeof opt === 'string') {
            return { text: opt };
          }
          return {
            text: String(opt?.text ?? '').trim(),
            correct: typeof opt?.correct === 'boolean' ? opt.correct : undefined,
            explanation: typeof opt?.explanation === 'string'
              ? opt.explanation
              : typeof opt?.explaination === 'string'
                ? opt.explaination
                : undefined,
          };
        })
        .filter((opt) => opt.text);
    } else {
      if (raw?.solution?.incorrectLotItems) {
        options = raw.solution.incorrectLotItems.map((item: any) => ({
          text: String(item?.text ?? '').trim(),
          correct: false,
          explanation: item?.explaination || item?.explanation || '',
        })).filter((opt: { text: string }) => opt.text);
      }

      if (raw?.solution?.correctLotItem?.text) {
        options.push({
          text: String(raw.solution.correctLotItem.text).trim(),
          correct: true,
          explanation: raw.solution.correctLotItem.explaination || raw.solution.correctLotItem.explanation || '',
        });
      }
    }

    const optionMap = new Map<string, { text: string; correct?: boolean; explanation?: string }>();
    options.forEach((opt) => {
      const normalizedText = String(opt?.text ?? '').replace(/\s+/g, ' ').trim();
      if (!normalizedText) {
        return;
      }

      const key = normalizedText.toLowerCase();
      const existing = optionMap.get(key);
      if (!existing) {
        optionMap.set(key, {
          text: normalizedText,
          correct: Boolean(opt?.correct),
          explanation: typeof opt?.explanation === 'string' ? opt.explanation.trim() : undefined,
        });
        return;
      }

      if (!existing.correct && opt?.correct) {
        existing.correct = true;
      }
      if (!existing.explanation && typeof opt?.explanation === 'string' && opt.explanation.trim()) {
        existing.explanation = opt.explanation.trim();
      }
    });

    let normalizedOptions = [...optionMap.values()];
    if (normalizedOptions.length < 2) {
      return null;
    }

    const trueCorrectOption = normalizedOptions.find((opt) => opt.correct === true);
    let trimmedOptions = normalizedOptions.slice(0, 4);
    if (trueCorrectOption && !trimmedOptions.some((opt) => opt.text.toLowerCase() === trueCorrectOption.text.toLowerCase())) {
      if (trimmedOptions.length === 4) {
        trimmedOptions[3] = trueCorrectOption;
      } else {
        trimmedOptions.push(trueCorrectOption);
      }
    }

    let correctIndex = trimmedOptions.findIndex((opt) => opt.correct === true);
    if (correctIndex < 0) {
      correctIndex = 0;
    }

    if (questionType === 'SOL') {
      trimmedOptions = trimmedOptions.map((opt, index) => ({
        ...opt,
        correct: index === correctIndex,
      }));
    }

    const parsedTimeLimitSeconds = Number(raw?.question?.timeLimitSeconds ?? raw?.timeLimitSeconds ?? 60);
    const parsedPoints = Number(raw?.question?.points ?? raw?.points ?? 5);

    return {
      questionText: questionText.replace(/\s+/g, ' ').trim(),
      options: trimmedOptions,
      solution: raw?.solution ?? '',
      isParameterized: raw?.question?.isParameterized ?? raw?.isParameterized ?? false,
      timeLimitSeconds: Number.isFinite(parsedTimeLimitSeconds) && parsedTimeLimitSeconds > 0
        ? parsedTimeLimitSeconds
        : 60,
      points: Number.isFinite(parsedPoints) && parsedPoints > 0 ? parsedPoints : 5,
      segmentId,
      questionType,
    };
  }

  private extractBalancedJSONSnippet(text: string, open: '[' | '{', close: ']' | '}'): string | null {
    const start = text.indexOf(open);
    if (start < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === open) {
        depth++;
      } else if (char === close) {
        depth--;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  private toJSONParseCandidates(rawText: string): string[] {
    const cleaned = extractJSONFromMarkdown(rawText || '').trim();
    if (!cleaned) {
      return [];
    }

    const candidates: string[] = [];
    const seen = new Set<string>();

    const pushCandidate = (candidate?: string | null) => {
      if (!candidate) {
        return;
      }

      const trimmed = candidate.trim();
      if (!trimmed || seen.has(trimmed)) {
        return;
      }

      seen.add(trimmed);
      candidates.push(trimmed);
    };

    pushCandidate(cleaned);
    pushCandidate(this.extractBalancedJSONSnippet(cleaned, '[', ']'));
    pushCandidate(this.extractBalancedJSONSnippet(cleaned, '{', '}'));

    return candidates;
  }

  private tryParseJSON(candidate: string): any | null {
    const parseAttempts = [
      candidate,
      candidate
        .replace(/^\uFEFF/, '')
        .replace(/,\s*([}\]])/g, '$1')
        .trim(),
    ];

    for (const attempt of parseAttempts) {
      try {
        return JSON.parse(attempt);
      } catch {
        // Try next candidate
      }
    }

    return null;
  }

  private isQuestionLikePayload(payload: any): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    if (typeof payload.questionText === 'string' && payload.questionText.trim()) {
      return true;
    }

    if (typeof payload.question === 'string' && payload.question.trim()) {
      return true;
    }

    if (typeof payload?.question?.text === 'string' && payload.question.text.trim()) {
      return true;
    }

    if (Array.isArray(payload.options)) {
      return true;
    }

    if (payload?.solution?.correctLotItem || payload?.solution?.incorrectLotItems) {
      return true;
    }

    return false;
  }

  private collectQuestionPayloads(payload: any, depth = 0): any[] {
    if (!payload || depth > 6) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload.flatMap((item) => this.collectQuestionPayloads(item, depth + 1));
    }

    if (typeof payload !== 'object') {
      return [];
    }

    const collected: any[] = [];
    if (this.isQuestionLikePayload(payload)) {
      collected.push(payload);
    }

    const knownContainerKeys = ['questions', 'items', 'data', 'result', 'results', 'output', 'response', 'content'];
    for (const key of knownContainerKeys) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        collected.push(...this.collectQuestionPayloads(payload[key], depth + 1));
      }
    }

    if (collected.length > 0) {
      return collected;
    }

    for (const value of Object.values(payload)) {
      if (Array.isArray(value) || (value && typeof value === 'object')) {
        collected.push(...this.collectQuestionPayloads(value, depth + 1));
      }
    }

    return collected;
  }

  private parseQuestionPayloadsFromText(rawText: string): any[] {
    const candidates = this.toJSONParseCandidates(rawText);

    for (const candidate of candidates) {
      const parsed = this.tryParseJSON(candidate);
      if (parsed === null || parsed === undefined) {
        continue;
      }

      const extracted = this.collectQuestionPayloads(parsed);
      if (extracted.length > 0) {
        return extracted;
      }

      if (this.isQuestionLikePayload(parsed)) {
        return [parsed];
      }
    }

    return [];
  }

  private questionSignature(question: GeneratedQuestion): string {
    const normalizedQuestion = question.questionText.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedOptions = (question.options || [])
      .map((option) => String(option?.text ?? '').replace(/\s+/g, ' ').trim().toLowerCase())
      .join('|');

    return `${normalizedQuestion}::${normalizedOptions}`;
  }

  private dedupeQuestions(questions: GeneratedQuestion[]): GeneratedQuestion[] {
    const seen = new Set<string>();
    return questions.filter((question) => {
      const signature = this.questionSignature(question);
      if (seen.has(signature)) {
        return false;
      }
      seen.add(signature);
      return true;
    });
  }

  private async requestQuestionsForSpec(args: {
    segmentId: string;
    transcript: string;
    questionType: string;
    count: number;
    model?: string;
    schema?: unknown;
    context: string;
  }): Promise<GeneratedQuestion[]> {
    const { segmentId, transcript, questionType, count, model, schema, context } = args;
    const prompt = this.createQuestionPrompt(questionType, count, transcript);
    const format = schema
      ? (count === 1
        ? schema
        : { type: 'array', items: schema, minItems: count, maxItems: count })
      : undefined;

    const text = await this.requestLLMCompletion({
      context,
      prompt,
      model,
      temperature: 0.2,
      format,
    });

    const parsedPayloads = this.parseQuestionPayloadsFromText(text);
    const normalizedQuestions = parsedPayloads
      .map((payload) => this.normalizeQuestion(payload, segmentId, questionType))
      .filter((question): question is GeneratedQuestion => Boolean(question));

    const deduped = this.dedupeQuestions(normalizedQuestions);
    console.log(
      `[${context}] Type=${questionType}, segment=${segmentId}, requested=${count}, parsed=${parsedPayloads.length}, valid=${deduped.length}`
    );

    return deduped;
  }

  private async generateQuestionsForSpecWithFallback(args: {
    segmentId: string;
    transcript: string;
    questionType: string;
    count: number;
    model?: string;
    schema?: unknown;
  }): Promise<GeneratedQuestion[]> {
    const { segmentId, transcript, questionType, count, model, schema } = args;

    const initial = await this.requestQuestionsForSpec({
      segmentId,
      transcript,
      questionType,
      count,
      model,
      schema,
      context: 'generateQuestions',
    });

    if (initial.length >= count) {
      return initial.slice(0, count);
    }

    if (count === 1) {
      return initial.slice(0, 1);
    }

    const recovered = [...initial];
    const maxRetries = Math.max(count * 2, 3);
    let retries = 0;

    console.warn(
      `[generateQuestions] Incomplete parse for type=${questionType}, segment=${segmentId}. Requested=${count}, got=${initial.length}. Running fallback retries.`
    );

    while (recovered.length < count && retries < maxRetries) {
      retries++;

      const retryResult = await this.requestQuestionsForSpec({
        segmentId,
        transcript,
        questionType,
        count: 1,
        model,
        schema,
        context: `generateQuestions:fallback:${questionType}:${retries}`,
      });

      const candidate = retryResult[0];
      if (!candidate) {
        continue;
      }

      const candidateSignature = this.questionSignature(candidate);
      const exists = recovered.some((question) => this.questionSignature(question) === candidateSignature);
      if (!exists) {
        recovered.push(candidate);
      }
    }

    return recovered.slice(0, count);
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
    const { segments, globalQuestionSpecification, model = aiConfig.mvpDummyModelToken } = args;

    if (!segments || Object.keys(segments).length === 0) {
      throw new HttpError(400, 'segments must be a non-empty object.');
    }
    if (!globalQuestionSpecification?.length || !Object.keys(globalQuestionSpecification[0] || {}).length) {
      throw new HttpError(400, 'globalQuestionSpecification must be a non-empty array with at least one spec.');
    }

    // // DEVELOPMENT MODE: Return dummy questions while Ollama is not set up
    // console.log('[generateQuestions] Using dummy response mode');
    // return [
    //   {
    //     questionText: "What is the primary purpose of React in web development?",
    //     options: [
    //       { text: "Database management", correct: false, explanation: "React is not a database management system" },
    //       { text: "View layer and UI components", correct: true, explanation: "React is primarily used for building user interfaces" },
    //       { text: "Server-side processing", correct: false, explanation: "React is primarily client-side" },
    //       { text: "Network security", correct: false, explanation: "React is not a security tool" }
    //     ],
    //     solution: "React is a JavaScript library for building user interfaces, particularly the view layer.",
    //     isParameterized: false,
    //     timeLimitSeconds: 60,
    //     points: 5,
    //     questionType: "SOL"
    //   },
    //   {
    //     questionText: "Which feature of React helps in optimizing performance by comparing virtual DOM?",
    //     options: [
    //       { text: "Event bubbling", correct: false, explanation: "This is a general JavaScript concept" },
    //       { text: "State management", correct: false, explanation: "While important, this isn't about DOM comparison" },
    //       { text: "Reconciliation", correct: true, explanation: "React's reconciliation process compares virtual DOM trees" },
    //       { text: "CSS-in-JS", correct: false, explanation: "This is about styling, not performance optimization" }
    //     ],
    //     solution: "React uses reconciliation to efficiently update the actual DOM by comparing virtual DOM trees.",
    //     isParameterized: false,
    //     timeLimitSeconds: 60,
    //     points: 5,
    //     questionType: "SOL"
    //   }
    // ];

    const questionSpecs = globalQuestionSpecification[0];
    const allQuestions: GeneratedQuestion[] = [];
    const resolvedModel = this.resolveModel(model);
    console.log(`[generateQuestions] Provider: ${this.provider}, requested model: ${model}, resolved model: ${resolvedModel}`);

    for (const rawSegmentId in segments) {
      const segmentId = String(rawSegmentId); // normalize
      const transcript = segments[segmentId];
      if (!transcript) continue;

      for (const [type, count] of Object.entries(questionSpecs)) {
        if (typeof count === 'number' && count > 0) {
          try {
            const schema = (questionSchemas as any)[type];
            if (!schema) console.warn(`[generateQuestions] No schema for type ${type}.`);

            const generatedForSpec = await this.generateQuestionsForSpecWithFallback({
              segmentId,
              transcript,
              questionType: type,
              count,
              model,
              schema,
            });

            allQuestions.push(...generatedForSpec);
            console.log(
              `[generateQuestions] Finalized ${generatedForSpec.length}/${count} ${type} questions for segment ${segmentId}`
            );
          } catch (e: any) {
            console.error(`[generateQuestions] Failed for type ${type}, segment ${segmentId}:`, e.message);
            if (e instanceof HttpError) {
              throw e;
            }
          }
        }
      }
    }

    console.log(`[generateQuestions] Done. Total questions: ${allQuestions.length}`);
    return allQuestions;
  }
}
