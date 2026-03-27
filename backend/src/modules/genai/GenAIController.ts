import { JsonController, Post, Body, Param, BadRequestError } from 'routing-controllers';
import { inject, injectable } from 'inversify';
import { AIContentService } from './services/AIContentService.js';
import { GENAI_TYPES } from './types.js';

@injectable()
@JsonController('/livequizzes/rooms')
export class GenAIController {
  constructor(
    @inject(GENAI_TYPES.AIContentService) private aiService: AIContentService
  ) {}

  @Post('/:roomCode/generate-questions')
  async generateQuestions(
    @Param('roomCode') roomCode: string,
    @Body() body: { transcript: string; questionCount?: number }
  ) {
    const transcript = body.transcript;
    const questionCount = parseInt(body.questionCount?.toString() || '3', 10);

    if (!transcript) {
      throw new BadRequestError('Transcript required');
    }

    try {
      const questions = await this.aiService.generateQuestions({
        segments: { default: transcript },
        globalQuestionSpecification: [{ SOL: questionCount }],
      });

      return {
        success: true,
        message: 'Questions generated successfully from transcript.',
        transcriptPreview: transcript.substring(0, 200) + '...',
        segmentsCount: 1,
        totalQuestions: questions.length,
        requestedQuestions: questionCount,
        questions,
      };
    } catch (err: any) {
      console.error('GenAIController error:', err);

      if (err.message?.includes('RESOURCE_EXHAUSTED')) {
        throw new BadRequestError(
          'Daily free quota for Gemini API exceeded. Please try again later.'
        );
      }

      throw new BadRequestError(
        err.message || 'Something went wrong while generating questions.'
      );
    }
  }
}