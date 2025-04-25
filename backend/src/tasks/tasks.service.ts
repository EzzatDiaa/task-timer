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

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
  ) {}

  async findAll(filter: { userId?: string } = {}): Promise<Task[]> {
    return this.tasksRepository.find({
      where: filter,
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string, userId?: string): Promise<Task> {
    const whereClause: any = { id };
    if (userId) {
      whereClause.userId = userId;
    }

    const task = await this.tasksRepository.findOne({ where: whereClause });
    if (!task) {
      throw new NotFoundException(
        `Task with ID ${id} not found${userId ? " or you don't have access" : ''}`,
      );
    }
    return task;
  }

  async create(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    const task = this.tasksRepository.create({ ...createTaskDto, userId });
    return this.tasksRepository.save(task);
  }

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    userId: string,
  ): Promise<Task> {
    // First verify the task exists and belongs to user
    const task = await this.findOne(id, userId);

    // Update the task
    const updatedTask = { ...task, ...updateTaskDto };
    return this.tasksRepository.save(updatedTask);
  }

  async remove(id: string, userId: string): Promise<void> {
    // First verify the task exists and belongs to user
    await this.findOne(id, userId);

    const result = await this.tasksRepository.delete({ id, userId });
    if (result.affected === 0) {
      throw new NotFoundException(
        `Task with ID ${id} not found or you don't have access`,
      );
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
        `Task with ID ${taskId} not found or you do not have access to it`,
      );
    }
    switch (operation) {
      case TimerOperation.START:
        return this.startTimer(task);
      case TimerOperation.STOP:
        return this.stopTimer(task);
      case TimerOperation.PAUSE:
        return this.pauseTimer(task);
      case TimerOperation.RESUME:
        return this.resumeTimer(task);
      case TimerOperation.RESET:
        return this.resetTimer(task);
      default:
        throw new BadRequestException(`Invalid timer operation: ${operation}`);
    }
  }

  private async startTimer(task: Task): Promise<Task> {
    // validate task status
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

    // Check if startedAt is null before using it
    if (!task.startedAt) {
      throw new BadRequestException(`Task has no start time`);
    }

    const now = new Date();
    task.pausedAt = now;
    task.timerStatus = TimerStatus.PAUSED;

    const elapsedTime = Math.floor(
      (now.getTime() - task.startedAt.getTime()) / 1000,
    );

    task.remainingTime = Math.max(
      0,
      task.remainingTime !== null ? task.remainingTime - elapsedTime : 0,
    );

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
    if (
      task.timerStatus !== TimerStatus.RUNNING &&
      task.timerStatus !== TimerStatus.PAUSED
    ) {
      throw new BadRequestException('Timer is not active');
    }

    task.timerStatus = TimerStatus.COMPLETED;
    task.isCompleted = true;

    return this.tasksRepository.save(task);
  }

  private async resetTimer(task: Task): Promise<Task> {
    // Reset timer to initial state
    task.timerStatus = TimerStatus.IDLE;
    task.startedAt = null;
    task.pausedAt = null;

    if (task.timerType === TimerType.COUNTDOWN) {
      task.remainingTime = task.countdownDuration;
    }

    task.isCompleted = false;

    return this.tasksRepository.save(task);
  }

  async checkTimerStatus(
    taskId: string,
    userId: string,
  ): Promise<{
    status: TimerStatus;
    remainingTime?: number;
    completed: boolean;
  }> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    let remainingTime: any;

    if (
      task.timerType === TimerType.COUNTDOWN &&
      task.timerStatus === TimerStatus.RUNNING
    ) {
      const now = new Date();
      // we need to check if the startedAt is null
      if (!task.startedAt || !task.remainingTime) {
        throw new BadRequestException(
          `Task has no start time or remaining time`,
        );
      }
      const elapsedTime = Math.floor(
        now.getTime() - task.startedAt.getTime() / 1000,
      );
      remainingTime = Math.max(0, task.remainingTime - elapsedTime);

      // Check if the timer has finished
      if (remainingTime === 0 && task.timerStatus === TimerStatus.RUNNING) {
        task.timerStatus = TimerStatus.COMPLETED;
        task.isCompleted = true;
        await this.tasksRepository.save(task);
      }
    } else if (
      task.timerType === TimerType.ALARM &&
      task.timerStatus === TimerStatus.RUNNING
    ) {
      // Check if alarm time has passed
      const now = new Date();
      if (!task.alarmTime) {
        throw new BadRequestException(`Task has no alarm time`);
      }
      if (
        new Date(task.alarmTime) <= now &&
        task.timerStatus === TimerStatus.RUNNING
      ) {
        task.timerStatus = TimerStatus.COMPLETED;
        task.isCompleted = true;
        await this.tasksRepository.save(task);
      }
    }
    return {
      status: task.timerStatus,
      remainingTime:
        task.timerType === TimerType.COUNTDOWN ? remainingTime : null,
      completed: task.isCompleted,
    };
  }
}
