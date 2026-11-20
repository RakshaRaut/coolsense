import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { ThingsboardService } from './thingsboard.service.js';

@Controller('thingsboard')
@UseGuards(JwtAuthGuard)
export class ThingsboardController {
  constructor(
    private readonly thingsboardService: ThingsboardService,
  ) {}

  @Get('status')
  getStatus() {
    return this.thingsboardService.getStatus();
  }

  @Post('test')
  async testConnection() {
    return this.thingsboardService.testConnection();
  }

  @Post('devices/:deviceId/sync')
  syncDevice(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() ownerId: string,
  ) {
    return this.thingsboardService.syncDevice(deviceId, ownerId);
  }

  @Get('devices/:deviceId/telemetry')
  getTelemetry(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() ownerId: string,
  ) {
    return this.thingsboardService.getDeviceTelemetry(deviceId, ownerId);
  }
}

@Controller('integrations/thingsboard')
@UseGuards(JwtAuthGuard)
export class ThingsboardIntegrationController {
  constructor(
    private readonly thingsboardService: ThingsboardService,
  ) {}

  @Get('status')
  getStatus(@CurrentUserId() ownerId: string) {
    return this.thingsboardService.getIntegrationStatus(ownerId);
  }

  @Post('sync')
  syncDevices(@CurrentUserId() ownerId: string) {
    return this.thingsboardService.syncOwnedDevices(ownerId);
  }
}