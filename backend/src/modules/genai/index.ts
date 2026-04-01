import { ContainerModule } from 'inversify';
import { genaiContainerModule } from './container.js';
import { RAGController } from './RAGController.js';
import { sharedContainerModule } from '#root/container.js';

export const genaiContainerModules: ContainerModule[] = [
  genaiContainerModule,
  sharedContainerModule,
];

export const genaiModuleControllers: Function[] = [
  RAGController,
];