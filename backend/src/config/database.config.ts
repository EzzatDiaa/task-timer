import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'zizo0110',
  database: process.env.DB_DATABASE || 'task_timer',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: true, // Only use synchronize in development
  logging: true,
});
