import {
  JsonController,
  Post,
  HttpCode,
  Body,
  Res,
} from 'routing-controllers';
import { injectable } from 'inversify';
import { Response } from 'express';
import { SpeechAnalysisService } from './services/SpeechAnalysisService.js';

interface AnalyzeSpeechBody {
  transcript: string;
  durationInSeconds: number;
  topic?: string;           // ← new optional field
}

@injectable()
@JsonController('/speech-scorer')
export default class SpeechScorerController {
  constructor(private speechAnalysisService: SpeechAnalysisService) {}

  @Post('/analyze')
  @HttpCode(200)
  async analyzeSpeech(@Body() body: AnalyzeSpeechBody, @Res() res: Response) {
    try {
      const { transcript, durationInSeconds, topic } = body;

      if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
        return res.status(400).json({ message: 'Transcript is required and must be a non-empty string.' });
      }
      if (!durationInSeconds || durationInSeconds <= 0) {
        return res.status(400).json({ message: 'durationInSeconds is required and must be a positive number.' });
      }

      const result = this.speechAnalysisService.analyze(transcript, durationInSeconds, topic);

      return res.json({ message: 'Speech analysis completed successfully.', ...result });
    } catch (err: any) {
      console.error('Error in SpeechScorerController.analyzeSpeech:', err);
      return res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    }
  }
}