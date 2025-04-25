import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TimerStatus, TimerType } from '../tasks/entities/task.entity';
import { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { UpdateTaskDto } from '../tasks/dto/update-task.dto';
import {
  TimerOperation,
  TimerOperationDto,
} from '../tasks/dto/timer-operation.dto';
import { now } from 'mongoose';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
  ) {}

  async findAll(): Promise<Task[]> {
    return this.tasksRepository.find();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async create(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    const task = this.tasksRepository.create({ ...createTaskDto, userId });
    return this.tasksRepository.save(task);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    const updateTask = { ...task, ...updateTaskDto };
    return this.tasksRepository.save(updateTask);
  }

  async remove(id: string): Promise<void> {
    const result = await this.tasksRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
  }

  async handleTimerOperation(
    timerOperationDto: TimerOperationDto,
    userId: string,
  ) {
    const { taskId, operation } = timerOperationDto;

    const task = await this.tasksRepository.findOne({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException(
        `Task with ID ${taskId} not found or you do not have acess to it`,
      );
    }
    switch (operation) {
      case TimerOperation.Start:
        return this.startTimer(task);
      case TimerOperation.Stop:
        return this.stopTimer(task);
      case TimerOperation.Pause:
        return this.pauseTimer(task);
      case TimerOperation.Resume:
        return this.resumeTimer(task);
      case TimerOperation.Reset:
        return this.resetTimer(task);
      default:
        throw new BadRequestException(`Invalid timer operation: ${operation}`);
    }
  }

  private async startTimer(task: Task): Promise<Task> {
    // validte task status
    if (task.timerStatus === TimerStatus.RUNNING) {
      throw new BadRequestException(`Task is already running`);
    }

    // start timer based on timer type
    if (task.timerType === TimerType.COUNTDOWN) {
      if (!task.countdownDuration) {
        throw new BadRequestException(`Countdown duration is not set`);
      }
      task.startedAt = new Date();
      task.remainingTime = task.countdownDuration;
      task.timerStatus = TimerStatus.RUNNING;
    } else if (task.timerType === TimerType.ALARM) {
      if (!task.alarmTime) {
        throw new BadRequestException(`Alarm time is not set`);
      }
      task.startedAt = new Date();
      if (task.alarmTime < task.startedAt) {
        throw new BadRequestException(`Alarm time Must be in the future`);
      }
      task.timerStatus = TimerStatus.RUNNING;
    }
    return this.tasksRepository.save(task);
  }

  private async pauseTimer(task: Task): Promise<Task> {
    // pause only for COUNTDOWN timerType
    if (task.timerType !== TimerType.COUNTDOWN) {
      throw new BadRequestException(
        `Pause operation is only valid for COUNTDOWN timer type`,
      );
    }
    if (task.timerStatus !== TimerStatus.RUNNING) {
      throw new BadRequestException(`Task is not running`);
    }
    const now = new Date();
    task.pausedAt = now;
    task.timerStatus = TimerStatus.PAUSED;
    const elapsedTime = Math.floor(
      (now.getTime() - task.startedAt.getTime()) / 1000,
    );
    task.remainingTime = Math.max(0, task.remainingTime - elapsedTime);

    return this.tasksRepository.save(task);
  }

  private async resumeTimer(task: Task): Promise<Task> {
    // resume only for COUNTDOWN timerType
    if (task.timerType !== TimerType.COUNTDOWN) {
      throw new BadRequestException(
        `Resume operation is only valid for COUNTDOWN timer type`,
      );
    }
    if (task.timerStatus !== TimerStatus.PAUSED) {
      throw new BadRequestException(`Task is not paused`);
    }
    const now = new Date();
    task.startedAt = now;
    task.timerStatus = TimerStatus.RUNNING;
    task.pausedAt = null;

    return this.tasksRepository.save(task);
  }

  private async stopTimer(task: Task): Promise<Task> {
    // stop only for COUNTDOWN timerType
    if (task.timerType !== TimerType.COUNTDOWN) {
      throw new BadRequestException(
        `Stop operation is only valid for COUNTDOWN timer type`,
      );
    }
    if (task.timerStatus !== TimerStatus.RUNNING) {
      throw new BadRequestException(`Task is not running`);
    }
    task.timerStatus = TimerStatus.IDLE;
    task.remainingTime = null;
    task.startedAt = null;
    task.pausedAt = null;

    return this.tasksRepository.save(task);
  }

  private async resetTimer(task: Task): Promise<Task> {
    // reset only for COUNTDOWN timerType
    if (task.timerType !== TimerType.COUNTDOWN) {
      throw new BadRequestException(
        `Reset operation is only valid for COUNTDOWN timer type`,
      );
    }
    task.timerStatus = TimerStatus.IDLE;
    task.remainingTime = task.countdownDuration;
    task.startedAt = null;
    task.pausedAt = null;

    return this.tasksRepository.save(task);
  }
}
