import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    const maxAttempts = 5;
    const retryDelayMs = 2_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        this.logger.log('Database connection established');
        return;
      } catch (error) {
        if (attempt === maxAttempts) {
          this.logger.error(
            `Database connection failed after ${maxAttempts} attempts: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          throw error;
        }

        this.logger.warn(
          `Database connection attempt ${attempt}/${maxAttempts} failed; retrying in ${
            retryDelayMs / 1000
          } seconds`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
