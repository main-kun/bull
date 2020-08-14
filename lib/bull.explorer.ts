import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createContextId, DiscoveryService, ModuleRef } from '@nestjs/core';
import { Injector } from '@nestjs/core/injector/injector';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { Module } from '@nestjs/core/injector/module';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { Job, Processor, Queue } from 'bullmq';
import { BullMetadataAccessor } from './bull-metadata.accessor';
import { NO_QUEUE_FOUND } from './bull.messages';
import { BullQueueEventOptions } from './bull.types';
import { BullWorkerOptions } from './decorators';
import { getQueueToken } from './utils';
import { BullWorkerStore } from './bull-worker.store';

@Injectable()
export class BullExplorer implements OnModuleInit {
  private readonly logger = new Logger('BullModule');
  private readonly injector = new Injector();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataAccessor: BullMetadataAccessor,
    private readonly metadataScanner: MetadataScanner,
    private readonly bullWorkerStore: BullWorkerStore,
  ) {}

  onModuleInit(): void {
    this.explore();
  }

  explore(): void {
    const providers: InstanceWrapper[] = this.discoveryService
      .getProviders()
      .filter((wrapper: InstanceWrapper) =>
        this.metadataAccessor.isQueueComponent(wrapper.metatype),
      );

    providers.forEach((wrapper: InstanceWrapper) => {
      const { instance, metatype } = wrapper;
      const isRequestScoped = !wrapper.isDependencyTreeStatic();
      const {
        name: queueName,
      } = this.metadataAccessor.getQueueComponentMetadata(metatype);

      const queueToken = getQueueToken(queueName);
      const bullQueue = this.getQueue(queueToken, queueName);

      this.metadataScanner.scanFromPrototype(
        instance,
        Object.getPrototypeOf(instance),
        (key: string) => {
          if (this.metadataAccessor.isProcessor(instance[key])) {
            const metadata = this.metadataAccessor.getProcessMetadata(
              instance[key],
            );
            this.handleProcessor(
              instance,
              key,
              metatype.name,
              bullQueue,
              wrapper.host,
              isRequestScoped,
              metadata,
            );
          } else if (this.metadataAccessor.isListener(instance[key])) {
            const metadata = this.metadataAccessor.getListenerMetadata(
              instance[key],
            );
            this.handleListener(instance, key, bullQueue, metadata);
          }
        },
      );
    });
  }

  getQueue(queueToken: string, queueName: string): Queue {
    try {
      return this.moduleRef.get<Queue>(queueToken, { strict: false });
    } catch (err) {
      this.logger.error(NO_QUEUE_FOUND(queueName));
      throw err;
    }
  }

  handleProcessor(
    instance: object,
    key: string,
    className: string,
    queue: Queue,
    moduleRef: Module,
    isRequestScoped: boolean,
    options?: BullWorkerOptions,
  ): void {
    let callback: Processor;
    if (isRequestScoped) {
      callback = async (...args: unknown[]) => {
        const contextId = createContextId();
        const contextInstance = await this.injector.loadPerContext(
          instance,
          moduleRef,
          moduleRef.providers,
          contextId,
        );
        return contextInstance[key].call(contextInstance, ...args);
      };
    } else {
      callback = instance[key].bind(instance);
    }
    const sharedOptions = {
      connection: queue.opts.connection,
      client: queue.opts.client,
      prefix: queue.opts.prefix,
    };
    this.bullWorkerStore.addWorker(className, key, queue.name, callback, {
      ...sharedOptions,
      ...options,
    });
  }

  handleListener(
    instance: object,
    key: string,
    queue: Queue,
    options: BullQueueEventOptions,
  ) {
    if (options.name || options.id) {
      queue.on(
        options.eventName,
        async (jobOrJobId: Job | string, ...args: unknown[]) => {
          const job =
            typeof jobOrJobId === 'string'
              ? (await queue.getJob(jobOrJobId)) || { name: false, id: false }
              : jobOrJobId;

          if (job.name === options.name || job.id === options.id) {
            return instance[key].apply(instance, [job, ...args]);
          }
        },
      );
    } else {
      queue.on(options.eventName, instance[key].bind(instance));
    }
  }
}
