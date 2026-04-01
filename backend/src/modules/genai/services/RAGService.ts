import { injectable, inject } from 'inversify';
import { EmbeddingService } from './EmbeddingService.js';
import { VectorStoreService } from './VectorStoreService.js';
import { AIContentService } from './AIContentService.js';
import type { QuestionSpec, GeneratedQuestion } from './AIContentService.js';

export interface RAGQuestion extends GeneratedQuestion {
  questionType: string;
  segmentId: string;
  sourceChunks: string[];
}

@injectable()
export class RAGService {
  constructor(
    @inject(EmbeddingService) private readonly embeddingService: EmbeddingService,
    @inject(VectorStoreService) private readonly vectorStoreService: VectorStoreService,
    @inject(AIContentService) private readonly aiContentService: AIContentService,
  ) {}

  public async ingestTranscript(
    segments: Record<string, string>,
    roomCode: string
  ): Promise<void> {
    console.log(`[RAGService] Ingesting ${Object.keys(segments).length} segments into ChromaDB...`);
    await this.vectorStoreService.storeSegments(segments, roomCode);
  }

  public async generateQuestions(args: {
    roomCode: string;
    questionSpec: QuestionSpec;
    topK?: number;
  }): Promise<RAGQuestion[]> {
    const { roomCode, questionSpec, topK = 3 } = args;
    const allQuestions: RAGQuestion[] = [];

    for (const [type, count] of Object.entries(questionSpec)) {
      if (typeof count !== 'number' || count <= 0) continue;

      // 1. Retrieve context from Chroma
      const query = this.buildRetrievalQuery(type);
      const chunks = await this.vectorStoreService.retrieveRelevantChunks(query, roomCode, topK);

      if (chunks.length === 0) {
        console.warn(`[RAGService] No context found for type ${type} in room ${roomCode}`);
        continue;
      }

      // 2. Generate using AIContentService (Ollama)
      const contextText = chunks.map(c => c.text).join('\n\n');
      const questions = await this.generateFromOllama(type, count, contextText, chunks);
      
      allQuestions.push(...questions);
    }

    console.log(`[RAGService] Final Question Count: ${allQuestions.length}`);
    return allQuestions;
  }

  private async generateFromOllama(
    type: string,
    count: number,
    context: string,
    chunks: any[]
  ): Promise<RAGQuestion[]> {
    try {
      // We pass the context as a single segment to the existing generator
      const segments = { "rag_context": context };
      const spec = [{ [type]: count }];

      const results = await this.aiContentService.generateQuestions({
        segments,
        globalQuestionSpecification: spec,
        model: 'llama3.2'
      });

      const segmentId = chunks[0]?.segmentId ?? 'rag_generated';
      const sourceChunks = chunks.map(c => c.text);

      return results.map(q => ({
        ...q,
        questionType: type,
        segmentId,
        sourceChunks,
      })) as RAGQuestion[];
    } catch (error: any) {
      console.error(`[RAGService] Ollama Question Gen Error:`, error.message);
      return [];
    }
  }

  private buildRetrievalQuery(type: string): string {
    const map: Record<string, string> = {
      SOL: 'main concept definition fact',
      SML: 'list of features multiple related points',
      OTL: 'sequence steps process order',
      NAT: 'numbers data measurements values',
      DES: 'detailed explanation concept theory'
    };
    return map[type] || 'key lecture content';
  }
} 