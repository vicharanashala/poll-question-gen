import { ContainerModule } from 'inversify';
import { LIVE_QUIZ_TYPES } from './types.js';
import { PollRoomController } from './controllers/PollRoomController.js';
import { PollService } from './services/PollService.js';
import { RoomService } from './services/RoomService.js';
import { pollSocket } from './utils/PollSocket.js';
import { DashboardService } from './services/DashboardService.js';
import {DashboardController} from './controllers/DashboardController.js';

// GenAI services
import { VideoService } from '#root/modules/genai/services/VideoService.js';
import { AudioService } from '#root/modules/genai/services/AudioService.js';
//import { TranscriptionService } from '#root/modules/genai/services/TranscriptionService.js';
import { AIContentService } from '#root/modules/genai/services/AIContentService.js';
import { RAGAIContentService } from '#root/modules/genai/services/RAGAIContentService.js';
import { CleanupService } from '#root/modules/genai/services/CleanupService.js';

export const livequizzesContainerModule = new ContainerModule((options) => {
  // Services
  options.bind(LIVE_QUIZ_TYPES.PollService).to(PollService).inSingletonScope();
  options.bind(LIVE_QUIZ_TYPES.RoomService).to(RoomService).inSingletonScope();
  options.bind(DashboardService).toSelf().inSingletonScope();

  // GenAI / media services
  options.bind(LIVE_QUIZ_TYPES.VideoService).to(VideoService).inSingletonScope();
  options.bind(LIVE_QUIZ_TYPES.AudioService).to(AudioService).inSingletonScope();
  //options.bind(LIVE_QUIZ_TYPES.TranscriptionService).to(TranscriptionService).inSingletonScope();
  options.bind(LIVE_QUIZ_TYPES.AIContentService).to(AIContentService).inSingletonScope();
  options.bind(LIVE_QUIZ_TYPES.RAGAIContentService).to(RAGAIContentService).inSingletonScope();
  options.bind(LIVE_QUIZ_TYPES.CleanupService).to(CleanupService).inSingletonScope();

  // Controllers
  options.bind(PollRoomController).toSelf().inSingletonScope();
  options.bind(DashboardController).toSelf().inSingletonScope();

  // Socket
  options.bind(LIVE_QUIZ_TYPES.PollSocket).toConstantValue(pollSocket);
});
