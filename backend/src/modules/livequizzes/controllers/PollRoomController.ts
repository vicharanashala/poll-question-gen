import {
  JsonController,
  Post,
  Get,
  Body,
  Param,
  Authorized,
  HttpCode,
  Req,
  Res,
  NotFoundError,
  Delete,
  BadRequestError,
} from 'routing-controllers';
import { Request, Response } from 'express';
import multer from 'multer';
import { pollSocket } from '../utils/PollSocket.js';
import { inject, injectable } from 'inversify';
import { RoomService } from '../services/RoomService.js';
import { PollService } from '../services/PollService.js';
import { LIVE_QUIZ_TYPES } from '../types.js';
//import { TranscriptionService } from '#root/modules/genai/services/TranscriptionService.js';
import { AIContentService } from '#root/modules/genai/services/AIContentService.js';
import { VideoService } from '#root/modules/genai/services/VideoService.js';
import { AudioService } from '#root/modules/genai/services/AudioService.js';
import { CleanupService } from '#root/modules/genai/services/CleanupService.js';
import type { QuestionSpec } from '#root/modules/genai/services/AIContentService.js';
// import type { File as MulterFile } from 'multer';
import { OpenAPI } from 'routing-controllers-openapi';
import dotenv from 'dotenv';
import mime from 'mime-types';
import * as fsp from 'fs/promises';
import { CreateInMemoryPollDto, InMemoryPollResponse, InMemoryPollResult, SubmitInMemoryAnswerDto } from '../validators/LivepollValidator.js';
import { validate } from 'class-validator';

dotenv.config();
const appOrigins = process.env.APP_ORIGINS;

declare module 'express-serve-static-core' {
  interface Request {
    file?: Express.Multer.File;
    files?: Express.Multer.File[];
  }
}
const upload = multer({ dest: 'uploads/' });

@injectable()
@OpenAPI({tags: ['Rooms'],})
@JsonController('/livequizzes/rooms')
export class PollRoomController {
  constructor(
    @inject(LIVE_QUIZ_TYPES.VideoService) private videoService: VideoService,
    @inject(LIVE_QUIZ_TYPES.AudioService) private audioService: AudioService,
    //@inject(LIVE_QUIZ_TYPES.TranscriptionService) private transcriptionService: TranscriptionService,
    @inject(LIVE_QUIZ_TYPES.AIContentService) private aiContentService: AIContentService,
    @inject(LIVE_QUIZ_TYPES.CleanupService) private cleanupService: CleanupService,
    @inject(LIVE_QUIZ_TYPES.RoomService) private roomService: RoomService,
    @inject(LIVE_QUIZ_TYPES.PollService) private pollService: PollService,
  ) { }

  //@Authorized(['teacher'])
  @Post('/')
  async createRoom(@Body() body: { name: string; teacherId: string }) {
    const room = await this.roomService.createRoom(body.name, body.teacherId);
    return {
      ...room,
      inviteLink: `${appOrigins}/student/pollroom/${room.roomCode}`,
    };
  }

  //@Authorized()
  @Get('/:code')
  async getRoom(@Param('code') code: string) {
    const room = await this.roomService.getRoomByCode(code);
    if (!room) {
      return { success: false, message: 'Room not found' };
    }
    if (room.status !== 'active') {
      return { success: false, message: 'Room is ended' };
    }
    return { success: true, room };  // return room data
  }  

  // 🔹 Create Poll in Room
  //@Authorized(['teacher','admin'])
  @Post('/:code/polls')
  async createPollInRoom(
    @Param('code') roomCode: string,
    @Body() body: { question: string; options: string[]; correctOptionIndex: number; creatorId: string; timer?: number }
  ) {
    const room = await this.roomService.getRoomByCode(roomCode);
    if (!room) throw new Error('Invalid room');
    return await this.pollService.createPoll(
      roomCode,
      {
        question: body.question,
        options: body.options,
        correctOptionIndex: body.correctOptionIndex,
        timer: body.timer
      }
    );

  }

  //@Authorized(['teacher'])
  @Get('/teacher/:teacherId')
  async getAllRoomsByTeacher(@Param('teacherId') teacherId: string) {
    return await this.roomService.getRoomsByTeacher(teacherId);
  }
  //@Authorized(['teacher'])
  @Get('/teacher/:teacherId/active')
  async getActiveRoomsByTeacher(@Param('teacherId') teacherId: string) {
    return await this.roomService.getRoomsByTeacherAndStatus(teacherId, 'active');
  }
  //@Authorized(['teacher'])
  @Get('/teacher/:teacherId/ended')
  async getEndedRoomsByTeacher(@Param('teacherId') teacherId: string) {
    return await this.roomService.getRoomsByTeacherAndStatus(teacherId, 'ended');
  }

  //@Authorized(['teacher'])
  @Get('/:roomId/analysis')
  async getPollAnalysis(@Param('roomId') roomId: string) {
    // Fetch from service
    const analysis = await this.roomService.getPollAnalysis(roomId);
    return { success: true, data: analysis };
  }

  //@Authorized()
  @Post('/:code/polls/answer')
  async submitPollAnswer(
    @Param('code') roomCode: string,
    @Body() body: { pollId: string; userId: string; answerIndex: number }
  ) {
    await this.pollService.submitAnswer(roomCode, body.pollId, body.userId, body.answerIndex);
    return { success: true };
  }

  // Fetch Results for All Polls in Room
  //@Authorized()
  @Get('/:code/polls/results')
  async getResultsForRoom(@Param('code') code: string) {
    return await this.pollService.getPollResults(code);
  }

  //@Authorized(['teacher'])
  @Post('/:code/end')
  async endRoom(@Param('code') code: string) {
    const success = await this.roomService.endRoom(code);
    if (!success) throw new Error('Room not found');
    // Emit to all clients in the room
    pollSocket.emitToRoom(code, 'room-ended', {});
    return { success: true, message: 'Room ended successfully' };
  }

@Get('/youtube-audio')
@HttpCode(200)
async getYoutubeAudio(@Req() req: Request, @Res() res: Response) {
  const youtubeUrl = req.query.url as string;
  const tempPaths: string[] = [];
  try {
    if (!youtubeUrl) {
      return res.status(400).json({ message: 'Missing YouTube URL.' });
    }
    console.log('Received YouTube URL:', youtubeUrl);
    // 1. Download the YouTube video (MP4 or similar)
    const videoPath = await this.videoService.downloadVideo(youtubeUrl);
    tempPaths.push(videoPath);

    // 2. Extract audio from video (MP3 or WAV)
    const audioPath = await this.audioService.extractAudio(videoPath);
    tempPaths.push(audioPath);

    // 3. Stream audio file to the client
    const mimeType = mime.lookup(audioPath) || 'audio/mpeg';
    const audioBuffer = await fsp.readFile(audioPath); 

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Content-Disposition', 'inline');

    console.log("🧪 Audio path:", audioPath);
    console.log("📦 Audio buffer size:", audioBuffer.length); // << This will likely be 44
    return res.send(audioBuffer);
  } catch (error: any) {
    console.error('Error in /youtube-audio:', error);
    await this.cleanupService.cleanup(tempPaths);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
}

  // 🔹 AI Question Generation from transcript or YouTube
  //@Authorized(['teacher'])
  @Post('/:code/generate-questions')
  @HttpCode(200)
  async generateQuestionsFromTranscript(
    @Req() req: Request,
    @Res() res: Response
  ) {
    const tempPaths: string[] = [];

    await new Promise<void>((resolve, reject) => {
      upload.single('file')(req, res, (err) => (err ? reject(err) : resolve()));
    });

    try {
      const { transcript, questionSpec, model, questionCount } = req.body;

      const SEGMENTATION_THRESHOLD = parseInt(process.env.TRANSCRIPT_SEGMENTATION_THRESHOLD || '6000', 10);
      const defaultModel = 'gemma3';
      const selectedModel = model?.trim() || defaultModel;

      // Parse questionCount with default value
      const numQuestions = questionCount ? parseInt(questionCount, 10) : 2;

      let segments: Record<string, string>;
      if (transcript.length <= SEGMENTATION_THRESHOLD) {
        console.log('[generateQuestions] Small transcript detected. Using full transcript without segmentation.');
        console.log('Transcript:', transcript);
        segments = { full: transcript };
      } else {
        console.log('[generateQuestions] Transcript is long; running segmentation...');
        segments = await this.aiContentService.segmentTranscript(transcript, selectedModel);
      }

      // ✅ Safe default questionSpec with custom count
      let safeSpec: QuestionSpec[] = [{ SOL: numQuestions }];
      if (questionSpec && typeof questionSpec === 'object' && !Array.isArray(questionSpec)) {
        safeSpec = [questionSpec];
      } else if (Array.isArray(questionSpec) && typeof questionSpec[0] === 'object') {
        safeSpec = questionSpec;
      } else {
        console.warn(`Invalid questionSpec provided; using default [{ SOL: ${numQuestions} }]`);
      }
      console.log('Using questionSpec:', safeSpec);
      console.log('[generateQuestions] Transcript length:', transcript.length);
      console.log('[generateQuestions] Transcript preview:', segments);
     
      console.log('[generateQuestions] Number of questions to generate:', numQuestions);
      const generatedQuestions = await this.aiContentService.generateQuestions({
        segments,
        globalQuestionSpecification: safeSpec,
        model: selectedModel,
      });

      return res.json({
        message: 'Questions generated successfully from transcript.',
        transcriptPreview: transcript.substring(0, 200) + '...',
        segmentsCount: Object.keys(segments).length,
        totalQuestions: generatedQuestions.length,
        requestedQuestions: numQuestions,
        questions: generatedQuestions,
      });
    } catch (err: any) {
      console.error('Error generating questions:', err);
      return res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
    } finally {
      await this.cleanupService.cleanup(tempPaths);
    }
  }
  
}