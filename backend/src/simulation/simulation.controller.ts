import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateSimulationDto } from './dto/create-simulation.dto.js';
import { UpdateSimulationDto } from './dto/update-simulation.dto.js';
import {
  SimulationDeviceQueryDto,
  SimulationEnvironmentUpdateDto,
  SimulationHistoryQueryDto,
  SimulationSpeedDto,
  StartSimulationDto,
} from './dto/simulation.dto.js';
import { SimulationService } from './simulation.service.js';

@Controller('simulation')
@UseGuards(JwtAuthGuard)
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Get()
  getSession(
    @CurrentUserId() userId: string,
    @Query() query: SimulationDeviceQueryDto,
  ) {
    return this.simulationService.getSession(userId, query.deviceId);
  }

  @Get('status')
  getStatus(
    @CurrentUserId() userId: string,
    @Query() query: SimulationDeviceQueryDto,
  ) {
    return this.simulationService.getSession(userId, query.deviceId);
  }

  @Get(':deviceId/status')
  getDeviceStatus(
    @CurrentUserId() userId: string,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
  ) {
    return this.simulationService.getSession(userId, deviceId);
  }

  @Post('start')
  start(@CurrentUserId() userId: string, @Body() input: StartSimulationDto) {
    return this.simulationService.start(userId, input);
  }

  @Post('stop')
  stop(
    @CurrentUserId() userId: string,
    @Body() input: SimulationDeviceQueryDto = new SimulationDeviceQueryDto(),
  ) {
    return this.simulationService.stop(userId, input.deviceId);
  }

  @Post('pause')
  pause(
    @CurrentUserId() userId: string,
    @Body() input: SimulationDeviceQueryDto = new SimulationDeviceQueryDto(),
  ) {
    return this.simulationService.pause(userId, input.deviceId);
  }

  @Post('resume')
  resume(
    @CurrentUserId() userId: string,
    @Body() input: SimulationDeviceQueryDto = new SimulationDeviceQueryDto(),
  ) {
    return this.simulationService.resume(userId, input.deviceId);
  }

  @Post('reset')
  reset(
    @CurrentUserId() userId: string,
    @Body() input: SimulationDeviceQueryDto = new SimulationDeviceQueryDto(),
  ) {
    return this.simulationService.reset(userId, input.deviceId);
  }

  @Patch('speed')
  setSpeed(
    @CurrentUserId() userId: string,
    @Body() input: SimulationSpeedDto,
  ) {
    return this.simulationService.setSpeed(userId, input);
  }

  @Patch('environment')
  updateEnvironment(
    @CurrentUserId() userId: string,
    @Body() input: SimulationEnvironmentUpdateDto,
  ) {
    return this.simulationService.updateEnvironment(userId, input);
  }

  @Get('series')
  getSeries(
    @CurrentUserId() userId: string,
    @Query() query: SimulationDeviceQueryDto,
  ) {
    return this.simulationService.getSeries(userId, query.deviceId);
  }
}

@Controller('simulations')
@UseGuards(JwtAuthGuard)
export class SimulationManagementController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Body() input: CreateSimulationDto,
  ) {
    return this.simulationService.create(userId, input);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.simulationService.findAll(userId);
  }

  @Get(':id')
  findOne(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    return this.simulationService.findOne(userId, simulationId);
  }

  @Post(':id/start')
  start(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    return this.simulationService.startSimulation(userId, simulationId);
  }

  @Post(':id/pause')
  pause(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    return this.simulationService.pauseSimulation(userId, simulationId);
  }

  @Post(':id/resume')
  resume(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    return this.simulationService.resumeSimulation(userId, simulationId);
  }

  @Post(':id/stop')
  stop(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    return this.simulationService.stopSimulation(userId, simulationId);
  }

  @Post(':id/reset')
  reset(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    return this.simulationService.resetSimulation(userId, simulationId);
  }

  @Patch(':id/config')
  updateConfig(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
    @Body() patch: UpdateSimulationDto,
  ) {
    return this.simulationService.updateConfig(userId, simulationId, patch);
  }

  @Get(':id/state')
  getState(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
  ) {
    return this.simulationService.getState(userId, simulationId);
  }

  @Get(':id/history')
  getHistory(
    @CurrentUserId() userId: string,
    @Param('id', new ParseUUIDPipe()) simulationId: string,
    @Query() query: SimulationHistoryQueryDto,
  ) {
    return this.simulationService.getHistory(
      userId,
      simulationId,
      query.limit,
    );
  }
}
