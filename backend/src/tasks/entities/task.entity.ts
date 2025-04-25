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

  @Column({ nullable: true })
  alarmTime: Date;

  @Column({ nullable: true })
  countdownDuration: number; // in seconds

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
