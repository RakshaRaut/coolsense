import { Injectable, Logger } from '@nestjs/common';
import type { Activity } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SimulationGateway } from '../simulation/simulation.gateway.js';

export type ActivityKind = 'power' | 'target' | 'mode' | 'device' | 'simulation' | 'sync';

export interface ActivityInput {
  kind: ActivityKind;
  message: string;
  deviceId?: string;
  deviceName?: string;
}

/** Shape of both GET /activities items and the activity:new socket event. */
export interface ActivityPayload extends ActivityInput {
  id: string;
  at: string;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: SimulationGateway,
  ) {
    // The gateway records lifecycle/command activities; injecting this service into it would be a DI cycle.
    gateway.activities = this;
  }

  /** Persists, then emits. Never rejects: a failed log must not break the action that caused it. */
  async record(userId: string, input: ActivityInput): Promise<void> {
    try {
      const deviceName =
        input.deviceName ??
        (input.deviceId
          ? (
              await this.prisma.device.findFirst({
                where: { id: input.deviceId, ownerId: userId },
                select: { name: true },
              })
            )?.name
          : undefined);
      const row = await this.prisma.activity.create({
        data: { userId, ...input, deviceName },
      });
      this.gateway.publishActivity(userId, toPayload(row));
    } catch (error) {
      this.logger.error(
        `Recording activity "${input.message}" for user ${userId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(userId: string, limit: number): Promise<ActivityPayload[]> {
    const rows = await this.prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toPayload);
  }
}

function toPayload(row: Activity): ActivityPayload {
  return {
    id: row.id,
    kind: row.kind as ActivityKind,
    message: row.message,
    ...(row.deviceId ? { deviceId: row.deviceId } : {}),
    ...(row.deviceName ? { deviceName: row.deviceName } : {}),
    at: row.createdAt.toISOString(),
  };
}
