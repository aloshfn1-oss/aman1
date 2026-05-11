import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: true, path: '/ws' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token || client.handshake.headers.authorization?.toString().replace('Bearer ', '')) ?? '';
      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET! });
      client.join(`user:${payload.sub}`);
    } catch { client.disconnect(); }
  }
  handleDisconnect() {}

  pushToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
  broadcast(event: string, data: unknown) { this.server.emit(event, data); }
}
