import { OnApplicationShutdown, Provider } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  BullModuleAsyncOptions,
  BullModuleOptions,
} from './interfaces/bull-module-options.interface';
import { getQueueOptionsToken, getQueueToken } from './utils';

function buildQueue(option: BullModuleOptions): Queue {
  const queue: Queue = new Queue(option.name ? option.name : 'default', option);
  ((queue as unknown) as OnApplicationShutdown).onApplicationShutdown = function (
    this: Queue,
  ) {
    return this.close();
  };
  return queue;
}

export function createQueueOptionProviders(options: BullModuleOptions[]): any {
  return options.map((option) => ({
    provide: getQueueOptionsToken(option.name),
    useValue: option,
  }));
}

export function createQueueProviders(options: BullModuleOptions[]): any {
  return options.map((option) => ({
    provide: getQueueToken(option.name),
    useFactory: (o: BullModuleOptions) => {
      const queueName = o.name || option.name;
      return buildQueue({ ...o, name: queueName });
    },
    inject: [getQueueOptionsToken(option.name)],
  }));
}

export function createAsyncQueueOptionsProviders(
  options: BullModuleAsyncOptions[],
): Provider[] {
  return options.map((option) => ({
    provide: getQueueOptionsToken(option.name),
    useFactory: option.useFactory,
    useClass: option.useClass,
    useExisting: option.useExisting,
    inject: option.inject,
  }));
}
