import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { SimulationConfig } from './models/simulation-config.model.js';
import type { SimulationState } from './models/simulation-state.model.js';
import { SimulationEngineService } from './engine/simulation-engine.service.js';

export interface SimulationExecutionContext {
  simulationId: string;
  timer: NodeJS.Timeout;
  currentState: SimulationState;
  config: SimulationConfig;
  lastTickAt: number;
  isTicking: boolean;
  initialState: SimulationState;
  lastSnapshotAt: number;
}

export type SimulationTickHandler = (
  simulationId: string,
  state: SimulationState,
  config: SimulationConfig,
  timestamp: Date,
  saveHistory: boolean,
) => Promise<void>;

@Injectable()
export class SimulationScheduler implements OnModuleDestroy {
  private readonly logger = new Logger(SimulationScheduler.name);
  private readonly contexts = new Map<string, SimulationExecutionContext>();

  constructor(private readonly engine: SimulationEngineService) {}

  get activeCount(): number {
    return this.contexts.size;
  }

  has(simulationId: string): boolean {
    return this.contexts.has(simulationId);
  }

  getState(simulationId: string): SimulationState | undefined {
    const state = this.contexts.get(simulationId)?.currentState;
    return state ? { ...state } : undefined;
  }

  start(
    simulationId: string,
    config: SimulationConfig,
    currentState: SimulationState,
    initialState: SimulationState,
    onTick: SimulationTickHandler,
  ): void {
    if (this.contexts.has(simulationId)) {
      throw new Error(`Simulation ${simulationId} is already scheduled`);
    }

    const now = Date.now();
    const timer = setInterval(() => {
      void this.tick(simulationId, onTick).catch((error: unknown) => {
        this.logger.error(
          `Simulation tick failed for ${simulationId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, 1000);
    this.contexts.set(simulationId, {
      simulationId,
      timer,
      currentState: { ...currentState },
      config: { ...config },
      lastTickAt: now,
      isTicking: false,
      initialState: { ...initialState },
      lastSnapshotAt: now,
    });
  }

  async stop(simulationId: string): Promise<SimulationState | undefined> {
    const context = this.contexts.get(simulationId);
    if (!context) {
      return undefined;
    }

    clearInterval(context.timer);
    while (context.isTicking) {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
    this.contexts.delete(simulationId);
    return { ...context.currentState };
  }

  update(
    simulationId: string,
    patch: {
      config?: Partial<SimulationConfig>;
      state?: Partial<SimulationState>;
    },
  ): boolean {
    const context = this.contexts.get(simulationId);
    if (!context) {
      return false;
    }

    if (patch.config) {
      context.config = { ...context.config, ...patch.config };
    }
    if (patch.state) {
      context.currentState = { ...context.currentState, ...patch.state };
    }
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.contexts.keys()].map((simulationId) => this.stop(simulationId)),
    );
  }

  private async tick(
    simulationId: string,
    onTick: SimulationTickHandler,
  ): Promise<void> {
    const context = this.contexts.get(simulationId);
    if (!context || context.isTicking) {
      return;
    }

    context.isTicking = true;
    try {
      const now = Date.now();
      const elapsedSeconds = Math.max(0.001, (now - context.lastTickAt) / 1000);
      const nextState = this.engine.step(
        context.currentState,
        context.config,
        elapsedSeconds * context.config.simulationSpeed,
      );
      const saveHistory = now - context.lastSnapshotAt >= 5000;
      await onTick(
        simulationId,
        nextState,
        context.config,
        new Date(now),
        saveHistory,
      );
      context.currentState = nextState;
      context.lastTickAt = now;
      if (saveHistory) {
        context.lastSnapshotAt = now;
      }
    } finally {
      context.isTicking = false;
    }
  }
}