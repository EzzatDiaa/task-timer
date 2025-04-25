import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum TimerType {
  ALARM = 'alarm',
  COUNTDOWN = 'countdown',
}

export enum TimerStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
}

@Entity()
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: TimerType,
    default: TimerType.COUNTDOWN,
  })
  timerType: TimerType;

  @Column({
    type: 'enum',
    enum: TimerStatus,
    default: TimerStatus.IDLE,
  })
  timerStatus: TimerStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null; // when the timer started

  @Column({ type: 'timestamp', nullable: true })
  pausedAt: Date | null; // when the timer was paused

  @Column({ type: 'integer', nullable: true })
  remainingTime: number | null; // for resumed countdown timer

  @Column({ type: 'timestamp', nullable: true })
  alarmTime: Date | null;

  @Column({ type: 'integer', nullable: true })
  countdownDuration: number | null; // in seconds

  @Column({ default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.tasks)
  user: User; // Many tasks can belong to one user

  @Column({ nullable: true })
  userId: string; // Foreign key to the user who created the task
}
