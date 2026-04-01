import { 
  JsonController, 
  Post, 
  Body, 
  Res, 
  HttpCode 
} from 'routing-controllers'; // Back to this!
import { injectable, inject } from 'inversify';
import { Response } from 'express';
import { RAGService } from './services/RAGService.js';
import { AIContentService } from './services/AIContentService.js';
import type { QuestionSpec } from './services/AIContentService.js';

@injectable()
@JsonController('/rag')
export class RAGController {
  constructor(
    @inject(AIContentService) private readonly aiContentService: AIContentService,
    @inject(RAGService) private readonly ragService: RAGService,
  ) {}

  @Post('/ingest-and-generate')
  @HttpCode(200)
  async ingestAndGenerate(
    @Body() body: { 
      transcript: string; 
      roomCode: string; 
      questionSpec?: QuestionSpec; 
      topK?: number; 
      model?: string 
    },
    @Res() res: Response,
  ) {
    try {
      const { transcript, roomCode, questionSpec, topK = 3, model } = body;

      if (!transcript?.trim() || !roomCode?.trim()) {
        return res.status(400).json({ message: 'transcript and roomCode are required.' });
      }

      // 1. Handle Segmentation
      const segments = { full: transcript }; // Simplified for test

      // 2. Ingest
      await this.ragService.ingestTranscript(segments, roomCode);

      // 3. Generate
      const questions = await this.ragService.generateQuestions({
        roomCode,
        questionSpec: questionSpec || { SOL: 2 },
        topK,
      });

      return res.json({
        message: 'Success!',
        questions,
      });
    } catch (err: any) {
      console.error('[RAGController] Error:', err);
      return res.status(500).json({ message: err.message });
    }
  }
}