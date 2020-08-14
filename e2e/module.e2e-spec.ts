import { Test, TestingModule } from '@nestjs/testing';
import { Queue, QueueEvents } from 'bullmq';
import { BullModule, getQueueToken, Process, Processor } from '../lib';
import {
  FakeConfProcessor,
  FakeProcessor,
  FakeProcessorOne,
  FakeProcessorTwo,
} from './fake.processor';
import { BullWorkerStore } from '../lib/bull-worker.store';

describe('BullModule', () => {
  let module: TestingModule;

  describe('registerQueue', () => {
    describe('single configuration', function () {
      beforeAll(async () => {
        module = await Test.createTestingModule({
          imports: [
            BullModule.registerQueue({
              name: 'test',
            }),
          ],
          providers: [FakeProcessor],
        }).compile();
        await module.init();
      });
      it('should inject the queue and add a worker to the worker store', () => {
        const queue: Queue = module.get<Queue>(getQueueToken('test'));
        const workerStore = module.get<BullWorkerStore>(BullWorkerStore);
        expect(queue).toBeDefined();
        expect(workerStore).toBeDefined();
        const worker = workerStore.getWorker('FakeProcessor_process');
        expect(worker.name).toEqual('test');
      });
    });
    describe('multiple configurations', () => {
      beforeAll(async () => {
        module = await Test.createTestingModule({
          imports: [
            BullModule.registerQueue({ name: 'test1' }, { name: 'test2' }),
          ],
        }).compile();
      });
      it('should inject a queue with name test1', () => {
        const queue: Queue = module.get<Queue>(getQueueToken('test1'));
        expect(queue).toBeDefined();
        expect(queue.name).toEqual('test1');
      });
      it('should inject a queue with name test2', () => {
        const queue: Queue = module.get<Queue>(getQueueToken('test2'));
        expect(queue).toBeDefined();
        expect(queue.name).toEqual('test2');
      });
    });
    describe('worker configuration from queue', () => {
      it('single configuration', async () => {
        module = await Test.createTestingModule({
          imports: [
            BullModule.registerQueue({
              name: 'test',
              connection: { host: '0.0.0.0', port: 6379 },
              prefix: 'testprefix',
            }),
          ],
          providers: [FakeProcessor],
        }).compile();
        await module.init();
        const queue: Queue = module.get<Queue>(getQueueToken('test'));
        expect(queue).toBeDefined();
        expect(queue.opts.connection).toEqual({ host: '0.0.0.0', port: 6379 });
        expect(queue.opts.prefix).toEqual('testprefix');
        const bullWorkerStore = module.get<BullWorkerStore>(BullWorkerStore);
        const worker = bullWorkerStore.getWorker('FakeProcessor_process');
        expect(worker).toBeDefined();
        expect(worker.opts.connection).toEqual({ host: '0.0.0.0', port: 6379 });
        expect(worker.opts.prefix).toEqual('testprefix');
      });

      it('multiple configurations', async () => {
        module = await Test.createTestingModule({
          imports: [
            BullModule.registerQueue(
              {
                name: 'test1',
                connection: { host: '0.0.0.0', port: 6379 },
                prefix: 'testprefix1',
              },
              {
                name: 'test2',
                connection: { host: '127.0.0.1', port: 6380 },
                prefix: 'testprefix2',
              },
            ),
          ],
          providers: [FakeProcessorOne, FakeProcessorTwo],
        }).compile();
        await module.init();
        const queue1: Queue = module.get<Queue>(getQueueToken('test1'));
        const queue2: Queue = module.get<Queue>(getQueueToken('test2'));
        expect(queue1.opts.connection).toEqual({ host: '0.0.0.0', port: 6379 });
        expect(queue2.opts.connection).toEqual({
          host: '127.0.0.1',
          port: 6380,
        });
        const bullWorkerStore = module.get<BullWorkerStore>(BullWorkerStore);
        const workerOne = bullWorkerStore.getWorker('FakeProcessorOne_process');
        const workerTwo = bullWorkerStore.getWorker('FakeProcessorTwo_process');
        expect(workerOne).toBeDefined();
        expect(workerTwo).toBeDefined();
        expect(workerOne.opts.connection).toEqual({
          host: '0.0.0.0',
          port: 6379,
        });
        expect(workerTwo.opts.connection).toEqual({
          host: '127.0.0.1',
          port: 6380,
        });
      });
    });

    it('worker configuration overriding queue configuration', async () => {
      module = await Test.createTestingModule({
        imports: [
          BullModule.registerQueue({
            name: 'testconf',
            connection: { host: '0.0.0.0', port: 6379 },
            prefix: 'testprefix',
          }),
        ],
        providers: [FakeConfProcessor],
      }).compile();
      await module.init();
      const queue = await module.get<Queue>(getQueueToken('testconf'));
      expect(queue.opts.connection).toEqual({ host: '0.0.0.0', port: 6379 });
      const workerStore = module.get<BullWorkerStore>(BullWorkerStore);
      const worker = workerStore.getWorker('FakeConfProcessor_process');
      expect(worker.opts.connection).toEqual({ host: '127.0.0.1', port: 6380 });
    });
  });

  describe('jobs handling', () => {
    // FulLTestProcessor is calling TestService.testFunc inside @Process
    // The test is set up this way because jest could not hook a spy correctly to processor.process
    // So the Processor.process function would get called however the spy would not mark those calls
    let queueEvents: QueueEvents;
    let testService: TestService;
    beforeAll(async () => {
      queueEvents = new QueueEvents('fulltest');
      await queueEvents.waitUntilReady();
      module = await Test.createTestingModule({
        imports: [
          BullModule.registerQueue({
            name: 'fulltest',
          }),
        ],
        providers: [FullTestProcessor, TestService],
      }).compile();
      await module.init();
      testService = module.get<TestService>(TestService);
      jest.spyOn(testService, 'testFunc');
    });
    it('should call handlers to process jobs', async () => {
      const queue = module.get<Queue>(getQueueToken('fulltest'));
      const job = await queue.add('jobname', { someKey: 'someValue' });
      await job.waitUntilFinished(queueEvents);
      expect(testService.testFunc).toHaveBeenCalled();
    });
  });
});
