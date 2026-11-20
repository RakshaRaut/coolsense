import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AcControlService } from './ac-control.service.js';
import { AcControlCommandDto } from './dto/ac-control-command.dto.js';
import { FanControlDto } from './dto/fan-control.dto.js';
import { ModeControlDto } from './dto/mode-control.dto.js';
import { PowerControlDto } from './dto/power-control.dto.js';
import { TemperatureControlDto } from './dto/temperature-control.dto.js';

@Controller('devices/:id/control')
@UseGuards(JwtAuthGuard)
export class LegacyAcControlController {
  constructor(private readonly acControlService: AcControlService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  applyCommand(
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: AcControlCommandDto,
  ) {
    return this.acControlService.applyCommand(deviceId, userId, input);
  }

  @Post('power')
  @HttpCode(HttpStatus.OK)
  setPower(
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: PowerControlDto,
  ) {
    return this.acControlService.setPower(deviceId, userId, input);
  }

  @Post('temperature')
  @HttpCode(HttpStatus.OK)
  setTemperature(
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: TemperatureControlDto,
  ) {
    return this.acControlService.setTemperature(deviceId, userId, input);
  }

  @Post('mode')
  @HttpCode(HttpStatus.OK)
  setMode(
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: ModeControlDto,
  ) {
    return this.acControlService.setMode(deviceId, userId, input);
  }

  @Post('fan')
  @HttpCode(HttpStatus.OK)
  setFanSpeed(
    @Param('id', new ParseUUIDPipe()) deviceId: string,
    @CurrentUserId() userId: string,
    @Body() input: FanControlDto,
  ) {
    return this.acControlService.setFanSpeed(deviceId, userId, input);
  }
}
