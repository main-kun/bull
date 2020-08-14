import { SetMetadata } from '@nestjs/common';
import { isString } from 'util';
import { BULL_MODULE_QUEUE_PROCESS } from '../bull.constants';
import { WorkerOptions } from 'bullmq';

export interface BullWorkerOptions extends WorkerOptions {
  name?: string;
}

export function Process(): MethodDecorator;
export function Process(name: string): MethodDecorator;
export function Process(options: BullWorkerOptions): MethodDecorator;
export function Process(
  nameOrOptions?: string | BullWorkerOptions,
): MethodDecorator {
  const options = isString(nameOrOptions)
    ? { name: nameOrOptions }
    : nameOrOptions;
  return SetMetadata(BULL_MODULE_QUEUE_PROCESS, options || {});
}
