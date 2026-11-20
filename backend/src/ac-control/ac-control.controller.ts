import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { FanControlDto } from './dto/fan-control.dto.js';
import { AcControlCommandDto } from './dto/ac-control-command.dto.js';
import { ModeControlDto } from './dto/mode-control.dto.js';
import { PowerControlDto } from './dto/power-control.dto.js';
import { TemperatureControlDto } from './dto/temperature-control.dto.js';
import { AcControlService } from './ac-control.service.js';

@Controller('ac-control/:deviceId')
@UseGuards(JwtAuthGuard)
export class AcControlController {
  constructor(private readonly acControlService: AcControlService) {}

  @Patch('power')
  setPower(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: PowerControlDto,
  ) {
    return this.acControlService.setPower(deviceId, userId, input);
  }

  @Patch('temperature')
  setTemperature(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: TemperatureControlDto,
  ) {
    return this.acControlService.setTemperature(deviceId, userId, input);
  }

  @Patch('mode')
  setMode(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: ModeControlDto,
  ) {
    return this.acControlService.setMode(deviceId, userId, input);
  }

  @Patch('fan-speed')
  setFanSpeed(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: FanControlDto,
  ) {
    return this.acControlService.setFanSpeed(deviceId, userId, input);
  }

  @Patch()
  applyCommand(
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: AcControlCommandDto,
  ) {
    return this.acControlService.applyCommand(deviceId, userId, input);
  }
}
