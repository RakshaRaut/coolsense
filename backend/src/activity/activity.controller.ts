import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ActivityService } from './activity.service.js';
import { ActivityQueryDto } from './dto/activity-query.dto.js';

@Controller('activities')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Query() query: ActivityQueryDto) {
    return this.activityService.list(userId, query.limit);
  }
}
