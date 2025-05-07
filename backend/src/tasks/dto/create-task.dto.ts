import {
  isEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDate,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { TimerType } from '../entities/task.entity';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum(TimerType)
  timerType: TimerType;

  @IsOptional()
  @IsDate()
  alarmTime?: Date;

  @IsOptional()
  @IsNumber()
  countdownDuration?: number;

  @IsOptional()
  @IsBoolean()
  isAutoRepeat?: boolean;
}
