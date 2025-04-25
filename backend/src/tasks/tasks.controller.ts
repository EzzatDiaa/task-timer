import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TimerOperationDto } from './dto/timer-operation.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Request() req: any): Promise<Task[]> {
    return this.tasksService.findAll({ userId: req.user.id });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any): Promise<Task> {
    return this.tasksService.findOne(id, req.user.id);
  }

  @Post()
  create(
    @Body() createTaskDto: CreateTaskDto,
    @Request() req: any,
  ): Promise<Task> {
    return this.tasksService.create(createTaskDto, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @Request() req: any,
  ): Promise<Task> {
    return this.tasksService.update(id, updateTaskDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.tasksService.remove(id, req.user.id);
  }

  @Post('timer')
  handleTimerOperation(
    @Body() timerOperationDto: TimerOperationDto,
    @Request() req: any,
  ): Promise<Task> {
    return this.tasksService.handleTimerOperation(
      timerOperationDto,
      req.user.id,
    );
  }

  @Get('timer/:id')
  checkTimerStatus(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<{
    status: string;
    remainingTime?: number;
    completed: boolean;
  }> {
    return this.tasksService.checkTimerStatus(id, req.user.id);
  }
}
