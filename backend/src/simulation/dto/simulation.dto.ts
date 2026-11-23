import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AcMode } from '../../common/enums/ac-mode.enum.js';
import { FanSpeed } from '../../common/enums/fan-speed.enum.js';

export enum InsulationLevel {
  POOR = 'poor',
  AVERAGE = 'average',
  GOOD = 'good',
  EXCELLENT = 'excellent',
}

export class SimulationEnvironmentDto {
  @IsOptional()
  @IsString()
  roomName?: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(1000)
  areaM2?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(10)
  heightM?: number;

  @IsOptional()
  @IsEnum(InsulationLevel)
  insulation?: InsulationLevel;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  occupancy?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-30)
  @Max(60)
  outsideTempC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  humidityPct?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  windowExposure?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(10000)
  heatGainW?: number;
}

export class StartSimulationDto {
  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(120)
  speed = 1;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(16)
  @Max(30)
  targetTempC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(16)
  @Max(30)
  targetTemperature?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(AcMode)
  mode?: AcMode;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(FanSpeed)
  fanSpeed?: FanSpeed;

  @IsOptional()
  @ValidateNested()
  @Type(() => SimulationEnvironmentDto)
  environment?: SimulationEnvironmentDto;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(16)
  @Max(30)
  roomTempC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-30)
  @Max(60)
  outsideTempC?: number;
}

export class SimulationDeviceQueryDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;
}

export class SimulationHistoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 100;
}

export class SimulationSpeedDto extends SimulationDeviceQueryDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(120)
  speed: number;
}

export class SimulationEnvironmentUpdateDto {
  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(16)
  @Max(40)
  roomTempC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(16)
  @Max(30)
  targetTempC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-30)
  @Max(60)
  outsideTempC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  humidityPct?: number;
}
