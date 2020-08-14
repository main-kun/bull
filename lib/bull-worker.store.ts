import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Processor, Worker, WorkerOptions } from 'bullmq';
import { WorkerAlreadyExistsException } from './worker-exists.exception';

@Injectable()
export class BullWorkerStore implements OnApplicationShutdown {
  private readonly workers: { [key: string]: Worker };

  constructor() {
    this.workers = {};
  }

  onApplicationShutdown(): Promise<any> {
    const promiseArr = [];
    Object.values(this.workers).forEach((worker) => promiseArr.push(worker));
    return Promise.all(promiseArr);
  }

  addWorker<T = any>(
    className: string,
    functionName: string,
    name: string,
    processor: string | Processor,
    options: WorkerOptions = {},
  ): Worker<T> {
    const key = `${className}_${functionName}`;
    if (this.workers[key]) {
      throw new WorkerAlreadyExistsException(className, functionName);
    }
    const worker = new Worker<T>(name, processor, options);
    this.workers[key] = worker;
    return worker;
  }

  getWorker(key: string): Worker {
    return this.workers[key];
  }
}
