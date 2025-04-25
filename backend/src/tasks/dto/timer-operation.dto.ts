import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum TimerOperation {
  START = 'start',
  STOP = 'stop',
  PAUSE = 'pause',
  RESUME = 'resume',
  RESET = 'reset',
}

export class TimerOperationDto {
  @IsUUID()
  taskId: string;

  @IsEnum(TimerOperation)
  operation: TimerOperation;
}
