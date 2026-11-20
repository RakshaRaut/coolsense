import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AnalyticsService } from './analytics.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller('devices/:id/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('energy/daily')
  getDailyEnergy(
    @Param('id') deviceId: string,
    @CurrentUserId() userId: string,
    @Query() query: any,
  ) {
    return this.analyticsService.getDailyEnergy(deviceId, userId, query);
  }

  @Get('energy/monthly')
  getMonthlyEnergy(
    @Param('id') deviceId: string,
    @CurrentUserId() userId: string,
    @Query() query: any,
  ) {
    return this.analyticsService.getMonthlyEnergy(deviceId, userId, query);
  }

  @Get('temperature')
  getTemperatureAnalysis(
    @Param('id') deviceId: string,
    @CurrentUserId() userId: string,
    @Query() query: any,
  ) {
    return this.analyticsService.getTemperatureAnalysis(deviceId, userId, query);
  }

  @Get('cooling')
  getCoolingPerformance(
    @Param('id') deviceId: string,
    @CurrentUserId() userId: string,
    @Query() query: any,
  ) {
    return this.analyticsService.getCoolingPerformance(deviceId, userId, query);
  }

  @Get('cost')
  getElectricityCost(
    @Param('id') deviceId: string,
    @CurrentUserId() userId: string,
    @Query() query: any,
  ) {
    return this.analyticsService.getElectricityCost(deviceId, userId, query);
  }
}