import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TelemetryQueryDto } from './dto/telemetry-query.dto.js';
import { TelemetryService } from './telemetry.service.js';

@Controller('devices/:deviceId/telemetry')
@UseGuards(JwtAuthGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Get('latest')
  getLatest(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() ownerId: string,
  ) {
    return this.telemetryService.getLatest(deviceId, ownerId);
  }

  @Get('history')
  getHistory(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() ownerId: string,
    @Query() query: TelemetryQueryDto,
  ) {
    return this.telemetryService.getHistory(deviceId, ownerId, query);
  }

  @Get('temperature')
  getTemperatureHistory(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() ownerId: string,
    @Query() query: TelemetryQueryDto,
  ) {
    return this.telemetryService.getTemperatureHistory(deviceId, ownerId, query);
  }

  @Get('energy')
  getEnergyHistory(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() ownerId: string,
    @Query() query: TelemetryQueryDto,
  ) {
    return this.telemetryService.getEnergyHistory(deviceId, ownerId, query);
  }
}