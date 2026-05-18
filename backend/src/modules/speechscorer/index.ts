import 'reflect-metadata';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {HttpErrorHandler} from '#shared/index.js';
import {speechScorerContainerModule} from './container.js';
import SpeechScorerController from './SpeechScorerController.js';

export const speechscorerContainerModules: ContainerModule[] = [
  speechScorerContainerModule,
  sharedContainerModule,
];

export const speechscorerModuleControllers: Function[] = [
  SpeechScorerController,
];

export async function setupSpeechscorerContainer(): Promise<void> {
  const container = new Container();
  await container.load(...speechscorerContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const speechscorerModuleOptions: RoutingControllersOptions = {
  controllers: speechscorerModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './SpeechScorerController.js';