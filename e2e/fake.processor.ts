import { Processor, Process } from '../lib/decorators';
import { Injectable } from '@nestjs/common';

@Processor('test')
export class FakeProcessor {
  @Process()
  process() {
    return Promise.resolve();
  }
}

@Processor('test1')
export class FakeProcessorOne {
  @Process()
  process() {
    return Promise.resolve();
  }
}

@Processor('test2')
export class FakeProcessorTwo {
  @Process()
  process() {
    return Promise.resolve();
  }
}

@Processor('testconf')
export class FakeConfProcessor {
  @Process({ connection: { host: '127.0.0.1' } })
  process() {
    return Promise.resolve();
  }
}
@Injectable()
export class TestService {
  testFunc() {
    return 'test';
  }
}

@Processor('fulltest')
export class FullTestProcessor {
  constructor(private readonly testService: TestService) {}

  @Process()
  async process() {
    return Promise.resolve(this.testService.testFunc());
  }
}
