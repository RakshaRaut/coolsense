import {
  Controller,
  Get,
  Delete,
  ForbiddenException,
  Param,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../auth/decorators/current-user-id.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getCurrentUser(@CurrentUserId() userId: string) {
    return this.usersService.getById(userId);
  }

  @Delete(':id')
  deleteUser(@CurrentUserId() userId: string, @Param('id') id: string) {
    // Any authenticated user could delete any account before this check.
    if (id !== userId) {
      throw new ForbiddenException('You can only delete your own account');
    }
    return this.usersService.deleteUser(id);
  }
}