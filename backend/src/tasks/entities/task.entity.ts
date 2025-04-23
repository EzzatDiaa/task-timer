import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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
}
