import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Client } from 'socket.io/dist/client';

// define structure for update data that will be sent to user
interface TimerUpdateData {
  taskId: string;
  status: string;
  remainingTime?: number;
  completed: boolean;
}

// add userId to track which user owns this connection
interface ClientWithUserId extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);
  // create Map to track which socker IDs belong to which users
  private userSockets: Map<string, string[]> = new Map();

  // Inject the Socket.IO server instance
  // this to send message to clients
  @WebSocketServer()
  server: Server;

  // inject the JWT service for authentacting connection
  // to verify the token sent during connection
  constructor(private jwtService: JwtService) {}

  // handle client connection
  async handleConnection(client: ClientWithUserId, ...args: any[]) {
    try {
      const token = client.handshake.query.token as string;

      if (!token) {
        this.logger.error('No auth token provided');
        client.disconnect();
        return;
      }

      // verify and decode the JWT
      const decode = this.jwtService.verify(token);
      const userId = decode.sub;

      client.userId = userId;

      // Register the socket in userSockets Map
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)?.push(client.id);

      this.logger.log(`CLient connected: ${client.id} (user: ${userId})`);
    } catch (error) {
      this.logger.debug('authentaction failed', error);
      client.disconnect();
    }
  }
  handleDisconnect(client: ClientWithUserId) {
    const userId = client.userId;

    if (userId) {
      const userSocketIds = this.userSockets.get(userId) || [];
      const updateSocketIds = userSocketIds.filter((id) => id !== client.id);

      if (updateSocketIds.length > 0) {
        this.userSockets.set(userId, updateSocketIds);
      } else {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client disconnectd: ${client.id}`);
  }

  // Handle timer.update events from event-emitter
  @OnEvent('timer.update')
  handleTimerUpdateEvent(payload: {
    userId: string;
    taskId: string;
    update: TimerUpdateData;
  }) {
    this.logger.log(`Received timer.update event for task ${payload.taskId}`);
    this.sendTimerUpdateToUser(payload.userId, payload.taskId, payload.update);
  }

  @OnEvent('timer.completed')
  handleTimerCompletedEvent(payload: {
    userId: string;
    taskId: string;
    title: string;
  }) {
    this.logger.log(
      `Received timer.completed event for task: ${payload.taskId}`,
    );
    this.sendTimerUpdateToUser(payload.userId, payload.taskId, {
      taskId: payload.taskId,
      status: 'COMPLETED',
      completed: true,
    });

    this.sendNotificationToUser(payload.userId, {
      type: 'TIMER_COMPLETED',
      title: 'Timer Completed',
      message: `Task "${payload.title}" has completed`,
      taskId: payload.taskId,
    });
  }

  // send timer update to a specific user
  private sendTimerUpdateToUser(
    userId: string,
    taskId: string,
    update: TimerUpdateData,
  ) {
    const socketIds = this.userSockets.get(userId) || [];

    if (socketIds.length > 0) {
      for (const socketId of socketIds) {
        this.server.to(socketId).emit('timer:update', {
          ...update,
          taskId,
        });
        this.logger.debug(`Sent timer update to socket ${socketId}`);
      }
      this.logger.debug(
        `Sent timer update for task ${taskId} to user ${userId}`,
      );
    }
  }

  // send notification to a specific user
  private sendNotificationToUser(userId: string, notification: any) {
    const socketIds = this.userSockets.get(userId) || [];

    if (socketIds.length > 0) {
      for (const socketId of socketIds) {
        this.server.to(socketId).emit('notification', notification);
      }
      this.logger.debug(`Sent notification to user ${userId}`);
    }
  }

  // Client can subscribe to updates for specific tasks
  @SubscribeMessage('subscribe:task')
  handleSubscribeTask(client: ClientWithUserId, taskId: string) {
    this.logger.debug(`Client ${client.id} subscribed to task ${taskId}`);

    return { event: 'subscribe:task', data: { success: true, taskId } };
  }
}
