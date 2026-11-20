import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from '../strategies/jwt.strategy.js';
import { DatabaseModule } from '../database/database.module.js';

function parseJwtExpiration(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) {
    throw new Error(
      'JWT_EXPIRES_IN must be a positive number followed by s, m, h, or d',
    );
  }

  const amount = Number(match[1]);
  const secondsPerUnit = (() => {
    switch (match[2]) {
      case 's':
        return 1;
      case 'm':
        return 60;
      case 'h':
        return 3600;
      default:
        return 86400;
    }
  })();
  const seconds = amount * secondsPerUnit;
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error(
      'JWT_EXPIRES_IN must resolve to a positive number of seconds',
    );
  }

  return seconds;
}

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: parseJwtExpiration(
            config.get<string>('JWT_EXPIRES_IN', '1d'),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
