import { ContainerModule, Container } from 'inversify';
import { genaiContainerModule } from './container.js';
import { RAGController } from './RAGController.js';
import { sharedContainerModule } from '#root/container.js';
// 1. Import the VectorStoreService so we can grab it from the container
import { VectorStoreService } from './services/VectorStoreService.js'; // Adjust this path if needed!

export const genaiContainerModules: ContainerModule[] = [
  genaiContainerModule,
  sharedContainerModule,
];

export const genaiModuleControllers: Function[] = [
  RAGController,
];




