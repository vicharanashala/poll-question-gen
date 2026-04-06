import { ContainerModule } from 'inversify';
import { SpeechAnalysisService } from './services/SpeechAnalysisService.js';

export const speechScorerContainerModule = new ContainerModule(options => {
  options.bind(SpeechAnalysisService).toSelf().inSingletonScope();
});