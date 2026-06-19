import { ContainerModule } from 'inversify';
import { VideoService } from './services/VideoService.js';
import { AudioService } from './services/AudioService.js';
import { AIContentService } from './services/AIContentService.js';
import { CleanupService } from './services/CleanupService.js';
import { GenAIController } from './GenAIController.js';
import { GENAI_TYPES } from './types.js';

export const genaiContainerModule = new ContainerModule(options => {
  // Services
  options.bind(VideoService).toSelf().inSingletonScope();
  options.bind(AudioService).toSelf().inSingletonScope();
  options.bind(AIContentService).toSelf().inSingletonScope();
  options.bind(CleanupService).toSelf().inSingletonScope();
  options.bind(GenAIController).toSelf().inSingletonScope();
});
