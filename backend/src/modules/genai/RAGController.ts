import { 
  JsonController, 
  Post, 
  Body, 
  Res, 
  HttpCode 
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { Response } from 'express';
import { RAGService } from './services/RAGService.js';
import { AIContentService } from './services/AIContentService.js';
import type { QuestionSpec } from './services/AIContentService.js';

// --- NEW HELPER FUNCTION ---
function chunkTextForRAG(rawText: string): Record<string, string> {
  // Splits the text by double newlines (paragraphs)
  const paragraphs = rawText.split(/\n\s*\n/); 
  const segments: Record<string, string> = {};

  let chunkIndex = 0;
  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (cleanPara.length > 20) { // Ignore tiny fragments
      segments[`chunk_${chunkIndex}`] = cleanPara;
      chunkIndex++;
    }
  }

  return segments;
}

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

      // --- THE CHANGE IS HERE ---
      // 1. Handle Segmentation properly
      const segments = chunkTextForRAG(transcript);

      // 2. Ingest (This will now ingest multiple chunks!)
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