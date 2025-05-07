import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
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
import { EventEmitter2 } from '@nestjs/event-emitter';

interface AtiveTimer {
  taskId: string;
  userId: string;
  timerType: TimerType;
  startedAt: Date;
  endTime?: Date; // form alarm tyoe
  remainingTime?: number;
  pausedAt?: Date;
}

@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);
  private activeTimers: Map<string, AtiveTimer> = new Map();
  private timerCheckInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('Module initialized');
    await this.loadActiveTimers(); // pasued or running timers

    this.timerCheckInterval = setInterval(() => this.checkActiveTimers(), 1000);

    this.logger.log('Timer tracking system initialized');
  }

  async onModuleDestroy() {
    this.logger.log('Module destroyed');
    clearInterval(this.timerCheckInterval);
    this.logger.log('Timer tracking system stopped');
  }

  private async loadActiveTimers() {
    try {
      const tasks = await this.tasksRepository.find({
        where: [
          { timerStatus: TimerStatus.RUNNING },
          { timerStatus: TimerStatus.PAUSED },
        ],
      });

      // register each task in the active timers interface
      for (const task of tasks) {
        this.registerActiveTimer(task);
      }

      this.logger.log(`Loaded ${tasks.length} active timers`);
    } catch (error) {
      this.logger.log(`faild to load active timers: ${error}`);
    }
  }

  private registerActiveTimer(task: Task) {
    if (!task.startedAt) {
      return;
    }

    const activeTimer: AtiveTimer = {
      taskId: task.id,
      userId: task.userId,
      timerType: task.timerType,
      startedAt: task.startedAt,
      pausedAt: task.pausedAt || undefined,
    };

    if (task.timerType === TimerType.ALARM) {
      activeTimer.endTime = task.alarmTime || undefined;
    } else if (task.timerType === TimerType.COUNTDOWN) {
      activeTimer.remainingTime = task.remainingTime || undefined;
    }
    // store in the map using taskId as the key
    this.activeTimers.set(task.id, activeTimer);
    this.logger.debug(`Registered activeTimer for task ${task.id}`);
  }

  private async checkActiveTimers() {
    const now = new Date();
    this.logger.debug('Check activ timers...');
    const completedTimerIds: string[] = [];

    // Iterate through all active timers
    for (const [taskId, timer] of this.activeTimers.entries()) {
      // Skip paused timers
      if (timer.pausedAt) {
        continue;
      }

      if (timer.timerType === TimerType.ALARM) {
        // For alarm timers, check if the alarm time has passed
        if (timer.endTime && timer.endTime <= now) {
          completedTimerIds.push(taskId);
        } else {
          // Emit timer update for running alarm timer
          this.emitTimerUpdate(taskId, timer.userId);
        }
      } else if (timer.timerType === TimerType.COUNTDOWN) {
        // For countdown timers, calculate elapsed time and check if completed
        if (timer.remainingTime !== undefined) {
          const elapsedSeconds = Math.floor(
            (now.getTime() - timer.startedAt.getTime()) / 1000,
          );
          const currentRemaining = Math.max(
            0,
            timer.remainingTime - elapsedSeconds,
          );

          // Update the remaining time in our tracker
          timer.remainingTime = currentRemaining;

          // If timer has reached zero, mark as completed
          if (currentRemaining === 0) {
            completedTimerIds.push(taskId);
          } else {
            // Emit timer update for running countdown timer
            this.emitTimerUpdate(taskId, timer.userId);
          }
        }
      }
    }
    // Process all completed timers
    for (const taskId of completedTimerIds) {
      await this.completeTimer(taskId);
      this.logger.debug(
        `Check completed. Active Timers: ${this.activeTimers.size}`,
      );
    }
  }

  private async completeTimer(taskId: string) {
    this.logger.log(`Completign timer for task ${taskId}`);
    try {
      const timer = this.activeTimers.get(taskId);
      if (!timer) return;

      const task = await this.tasksRepository.findOne({
        where: { id: taskId },
      });
      if (task) {
        task.timerStatus = TimerStatus.COMPLETED;
        task.isCompleted = true;
        await this.tasksRepository.save(task);

        this.activeTimers.delete(taskId);

        // emit the event
        this.logger.log(`Emitting timer.completed event for task ${taskId}`);
        this.eventEmitter.emit('timer.completed', {
          taskId: taskId,
          userId: task.userId,
          title: task.title,
        });
        this.logger.log(`Timer completed for task ${taskId}`);
      }
    } catch (error) {
      this.logger.debug(`Error completing timer for task ${taskId}`, error);
    }
  }

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
  ): Promise<Task> {
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
    const savedTask = await this.tasksRepository.save(task);
    this.registerActiveTimer(savedTask);
    return savedTask;
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

    const savedTask = this.tasksRepository.save(task);
    const activeTimer = this.activeTimers.get(task.id);
    if (activeTimer) {
      activeTimer.pausedAt = now;
      activeTimer.remainingTime = task.remainingTime;
    }
    return savedTask;
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

    const savedTask = this.tasksRepository.save(task);
    const activeTimer = this.activeTimers.get(task.id);
    if (activeTimer) {
      activeTimer.startedAt = now;
      activeTimer.pausedAt = undefined;
    }
    return savedTask;
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

    const savedTask = this.tasksRepository.save(task);
    this.activeTimers.delete(task.id);

    this.eventEmitter.emit('timer.completed', {
      taskId: task.id,
      userId: task.id,
      title: task.title,
    });
    return savedTask;
  }

  // private async autoRepeatTimer(task: Task): Promise<Task> {
  //   if (task.isCompleted && task.timerType === TimerType.COUNTDOWN) {
  //     await this.resetTimer(task);
  //     await this.startTimer(task);
  //   }
  //   return this.tasksRepository.save(task);
  // }

  private async resetTimer(task: Task): Promise<Task> {
    // Reset timer to initial state
    task.timerStatus = TimerStatus.IDLE;
    task.startedAt = null;
    task.pausedAt = null;

    if (task.timerType === TimerType.COUNTDOWN) {
      task.remainingTime = task.countdownDuration;
    }

    task.isCompleted = false;

    const savedTask = this.tasksRepository.save(task);
    this.activeTimers.delete(task.id);

    return savedTask;
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

    // Get the most accurate timer state
    if (task.timerStatus === TimerStatus.RUNNING) {
      // Check if this timer is in our active timers map
      const activeTimer = this.activeTimers.get(taskId);

      if (activeTimer && task.timerType === TimerType.COUNTDOWN) {
        // Calculate the precise remaining time
        const now = new Date();
        const elapsedTime = Math.floor(
          (now.getTime() - activeTimer.startedAt.getTime()) / 1000,
        );

        remainingTime = Math.max(
          0,
          activeTimer.remainingTime !== undefined
            ? activeTimer.remainingTime - elapsedTime
            : 0,
        );

        // If timer has completed but not yet updated in DB
        if (remainingTime === 0 && task.timerStatus === TimerStatus.RUNNING) {
          // Update the DB (the background process will do this too, but this makes the response immediate)
          task.timerStatus = TimerStatus.COMPLETED;
          task.isCompleted = true;
          await this.tasksRepository.save(task);
        }
      } else if (task.timerType === TimerType.ALARM) {
        // For alarm timers, check if alarm time has passed
        const now = new Date();
        const alarmTime = task.alarmTime;

        if (alarmTime && new Date(alarmTime) <= now) {
          task.timerStatus = TimerStatus.COMPLETED;
          task.isCompleted = true;
          await this.tasksRepository.save(task);
        }
      }
    } else if (task.timerStatus === TimerStatus.PAUSED) {
      // For paused timers, use the stored remaining time
      remainingTime = task.remainingTime;
    }

    return {
      status: task.timerStatus,
      remainingTime:
        task.timerType === TimerType.COUNTDOWN ? remainingTime : undefined,
      completed: task.isCompleted,
    };
  }
  private async emitTimerUpdate(taskId: string, userId: string) {
    try {
      const task = await this.tasksRepository.findOne({
        where: { id: taskId },
      });
      if (!task) return;

      let remainingTime: number | undefined = undefined;

      const activeTimer = this.activeTimers.get(taskId);

      if (activeTimer && task.timerType === TimerType.COUNTDOWN) {
        const now = new Date();
        const elapsedTime = Math.floor(
          (now.getTime() - activeTimer.startedAt.getTime()) / 1000,
        );

        remainingTime = Math.max(
          0,
          activeTimer.remainingTime !== undefined
            ? activeTimer.remainingTime - elapsedTime
            : 0,
        );
      }

      // Emit timer update event
      this.eventEmitter.emit('timer.update', {
        userId,
        taskId,
        update: {
          taskId,
          status: task.timerStatus,
          remainingTime:
            task.timerType === TimerType.COUNTDOWN ? remainingTime : undefined,
          completed: task.isCompleted,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error emitting timer update for task ${taskId}`,
        error,
      );
    }
  }
}
