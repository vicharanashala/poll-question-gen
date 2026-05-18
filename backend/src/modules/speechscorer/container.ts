import { ContainerModule } from 'inversify';
import { SpeechAnalysisService } from './services/SpeechAnalysisService.js';
import SpeechScorerController from '../speechscorer/SpeechScorerController.js';

export const speechScorerContainerModule = new ContainerModule(options => {
  options.bind(SpeechAnalysisService).toSelf().inSingletonScope();
  options.bind(SpeechScorerController).toSelf().inSingletonScope();
});