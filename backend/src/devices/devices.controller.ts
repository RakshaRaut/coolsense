import {
  Body,
  Controller,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateDeviceDto } from './dto/create-device.dto.js';
import { UpdateDeviceDto } from './dto/update-device.dto.js';
import {
  DeviceHistoryQueryDto,
  TelemetryQueryDto,
} from './dto/telemetry-query.dto.js';
import { DevicesService } from './devices.service.js';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() input: CreateDeviceDto) {
    return this.devicesService.create(userId, input);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.devicesService.findAllForUser(userId);
  }

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @Body() input: UpdateDeviceDto,
  ) {
    return this.devicesService.updateOwnedDevice(deviceId, userId, input);
  }

  @Get(':id/state')
  getState(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) deviceId: string,
  ) {
    return this.devicesService.getState(deviceId, userId);
  }

  @Get(':id/telemetry')
  getTelemetry(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @Query() query: TelemetryQueryDto,
  ) {
    return this.devicesService.getTelemetry(deviceId, userId, query);
  }

  @Get(':id/history')
  getHistory(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @Query() query: DeviceHistoryQueryDto,
  ) {
    return this.devicesService.getHistory(deviceId, userId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) deviceId: string,
  ) {
    return this.devicesService.findOwnedDevice(deviceId, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) deviceId: string,
  ) {
    return this.devicesService.deleteOwnedDevice(deviceId, userId);
  }
}
