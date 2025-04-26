// Task timer types
export enum TimerType {
  ALARM = "alarm",
  COUNTDOWN = "countdown",
}

// Task Timer status
export enum TimerStatus {
  IDLE = "idle",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
}

// Task Timer Operations
export enum TimerOperation {
  START = "start",
  PAUSE = "pause",
  RESUME = "resume",
  STOP = "stop",
  RESET = "reset",
}

// Task Interface
export interface Task {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  timerType: TimerType;
  timerStatus: TimerStatus;
  alarmTime?: string; // ISO string for alarm time
  countdownDuration?: number; // in seconds for countdown
  remainingTime?: number; // in seconds for countdown
  startedAt?: string; // when the timer started
  pausedAt?: string; // when the timer was paused
  isCompleted?: boolean; // when the timer was completed
  userId: string; // user who created the task
}

// create Task DTO
export interface CreateTaskDto {
  title: string;
  description: string;
  timerType: TimerType;
  alarmTime?: string;
  countdownDuration?: number;
}

// update Task DTO
export interface UpdateTaskDto {
  title?: string;
  description?: string;
  timerType?: TimerType;
  alarmTime?: string;
  countdownDuration?: number;
  isCompleted?: boolean;
}

// Timer Operations DTO
export interface TimerOperationsDto {
  taskId: string;
  operation: TimerOperation;
}

// Timer status response
export interface TimerStatusResponse {
  status: TimerStatus;
  remainingTime?: number;
  completed: boolean;
}
