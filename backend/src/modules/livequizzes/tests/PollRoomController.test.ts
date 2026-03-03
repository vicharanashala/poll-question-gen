/*import 'reflect-metadata';
import request from 'supertest';
import express from 'express';
import { useExpressServer, useContainer } from 'routing-controllers';
import { describe, it, beforeAll, expect, vi, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { PollRoomController } from '../controllers/PollRoomController.js';
import { RoomService } from '../services/RoomService.js';
import { PollService } from '../services/PollService.js';
import { TranscriptionService } from '#root/modules/genai/services/TranscriptionService.js';
import { AIContentService } from '#root/modules/genai/services/AIContentService.js';
import { VideoService } from '#root/modules/genai/services/VideoService.js';
import { AudioService } from '#root/modules/genai/services/AudioService.js';
import { CleanupService } from '#root/modules/genai/services/CleanupService.js';

// Mock the pollSocket module
vi.mock('../utils/PollSocket.js', () => ({
    pollSocket: {
        emitToRoom: vi.fn()
    }
}));

const mockRoomService = {
    createRoom: vi.fn().mockResolvedValue({ id: '1', name: 'Test Room', roomCode: 'abc123' }),
    getRoomByCode: vi.fn().mockResolvedValue({ id: '1', status: 'active' }),
    getRoomsByTeacher: vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
    getRoomsByTeacherAndStatus: vi.fn().mockResolvedValue([{ id: '1' }]),
    endRoom: vi.fn().mockResolvedValue(true),
    getPollAnalysis: vi.fn().mockResolvedValue({ summary: 'results' }),
};

const mockPollService = {
    createPoll: vi.fn().mockResolvedValue({ id: 'poll1' }),
    submitAnswer: vi.fn().mockResolvedValue(undefined),
    getPollResults: vi.fn().mockResolvedValue([{ id: 'poll1', result: 'A' }]),
};

const mockTranscriptionService = {
    transcribe: vi.fn().mockResolvedValue('sample transcript'),
};

const mockAIContentService = {
    generateQuestions: vi.fn().mockResolvedValue([
        { question: 'What is 2+2?', options: ['3', '4'], correctOptionIndex: 1 }
    ]),
    segmentTranscript: vi.fn().mockResolvedValue({ full: 'sample transcript' }),
};

const mockVideoService = {
    downloadVideo: vi.fn().mockResolvedValue('video.mp4'),
};

const mockAudioService = {
    extractAudio: vi.fn().mockResolvedValue('audio.mp3'),
};

const mockCleanupService = {
    cleanup: vi.fn().mockResolvedValue(undefined),
};

// Create a simple container that manually injects dependencies
class TestContainer {
    get(target: any) {
        // Manually create controller with mocked dependencies
        if (target === PollRoomController || target.name === 'PollRoomController') {
            return new PollRoomController(
                mockVideoService as any,
                mockAudioService as any,
                mockTranscriptionService as any,
                mockAIContentService as any,
                mockCleanupService as any,
                mockRoomService as any,
                mockPollService as any
            );
        }

        // Return mock services directly
        switch (target.name) {
            case 'RoomService': return mockRoomService;
            case 'PollService': return mockPollService;
            case 'TranscriptionService': return mockTranscriptionService;
            case 'AIContentService': return mockAIContentService;
            case 'VideoService': return mockVideoService;
            case 'AudioService': return mockAudioService;
            case 'CleanupService': return mockCleanupService;
            default:
                console.warn(`Unknown service requested: ${target.name || target}`);
                // Try to instantiate if it's a constructor
                try {
                    return new target();
                } catch (error) {
                    throw new Error(`Unknown service: ${target.name || target}`);
                }
        }
    }
}

describe('PollRoomController Integration Tests', () => {
    let app: express.Express;

    beforeAll(() => {
        const testContainer = new TestContainer();

        app = express();
        app.use(express.json());

        // Set up routing-controllers with our test container
        useContainer(testContainer);

        useExpressServer(app, {
            controllers: [PollRoomController],
            // Remove HttpErrorHandler from middlewares for testing
            // middlewares: [HttpErrorHandler],
            defaultErrorHandler: true, // Use default error handler instead
            authorizationChecker: () => true, // always authorized
        });
    });

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks();
    });

    it('GET /livequizzes/rooms/:code - get room info', async () => {
        const res = await request(app).get('/livequizzes/rooms/abc123');

        if (res.status !== 200) {
            console.error('Response status:', res.status);
            console.error('Response body:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockRoomService.getRoomByCode).toHaveBeenCalledWith('abc123');
    });

    it('GET /livequizzes/rooms/teacher/:teacherId - get all rooms by teacher', async () => {
        const res = await request(app).get('/livequizzes/rooms/teacher/teach1');

        if (res.status !== 200) {
            console.error('Response status:', res.status);
            console.error('Response body:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(mockRoomService.getRoomsByTeacher).toHaveBeenCalledWith('teach1');
    });

    it('GET /livequizzes/rooms/:roomId/analysis - get poll analysis', async () => {
        const res = await request(app).get('/livequizzes/rooms/room1/analysis');

        if (res.status !== 200) {
            console.error('Response status:', res.status);
            console.error('Response body:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockRoomService.getPollAnalysis).toHaveBeenCalledWith('room1');
    });

    it('GET /livequizzes/rooms/:code/polls/results - get poll results', async () => {
        const res = await request(app).get('/livequizzes/rooms/abc123/polls/results');

        if (res.status !== 200) {
            console.error('Response status:', res.status);
            console.error('Response body:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body[0].id).toBe('poll1');
        expect(mockPollService.getPollResults).toHaveBeenCalledWith('abc123');
    });

    it('POST /livequizzes/rooms/:code/end - end room', async () => {
        const res = await request(app)
            .post('/livequizzes/rooms/abc123/end')
            .send({ teacherId: 'teach1' });

        if (res.status !== 200) {
            console.error('Response status:', res.status);
            console.error('Response body:', res.body);
        }

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockRoomService.endRoom).toHaveBeenCalledWith('abc123', 'teach1');
    });

    it('POST /livequizzes/rooms/:code/generate-questions - generate questions from YouTube URL', async () => {
        // Setup mock environment variable
        process.env.TRANSCRIPT_SEGMENTATION_THRESHOLD = '6000';

        const res = await request(app)
            .post('/livequizzes/rooms/abc123/generate-questions')
            .send({
                youtubeUrl: 'https://youtube.com/example',
                questionSpec: { SOL: 2 },
                model: 'gemma3',
            });

        if (res.status !== 200) {
            console.error('Response status:', res.status);
            console.error('Response body:', res.body);
            console.error('Response text:', res.text);
        }

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Questions generated successfully');
        expect(res.body.questions.length).toBeGreaterThan(0);
        expect(mockVideoService.downloadVideo).toHaveBeenCalledWith('https://youtube.com/example');
        expect(mockAudioService.extractAudio).toHaveBeenCalled();
        expect(mockTranscriptionService.transcribe).toHaveBeenCalled();
    });
});
*/