import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception';

export class WorkerAlreadyExistsException extends RuntimeException {
  constructor(className: string, functionName: string) {
    super(`Duplicate @Processor ${className} with @Process ${functionName} `);
  }
}
