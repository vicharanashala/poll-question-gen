import { ContainerModule } from 'inversify';
import { VideoService } from './services/VideoService.js';
import { AudioService } from './services/AudioService.js';
import { AIContentService } from './services/AIContentService.js';
import { CleanupService } from './services/CleanupService.js';
import { EmbeddingService } from './services/EmbeddingService.js';
import { VectorStoreService } from './services/VectorStoreService.js';
import { RAGService } from './services/RAGService.js';
import { RAGController } from './RAGController.js';

export const genaiContainerModule = new ContainerModule(options => {
  options.bind(VideoService).toSelf().inSingletonScope();
  options.bind(AudioService).toSelf().inSingletonScope();
  options.bind(AIContentService).toSelf().inSingletonScope();
  options.bind(CleanupService).toSelf().inSingletonScope();
  options.bind(EmbeddingService).toSelf().inSingletonScope();
  options.bind(VectorStoreService).toSelf().inSingletonScope();
  options.bind(RAGService).toSelf().inSingletonScope();
  options.bind(RAGController).toSelf().inSingletonScope();
});