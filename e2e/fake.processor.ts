import { Processor, Process } from '../lib/decorators';

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
  @Process({ connection: { host: '127.0.0.1', port: 6380 } })
  process() {
    return Promise.resolve();
  }
}
