import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AcMode } from '../../common/enums/ac-mode.enum.js';
import { AcType } from '../../common/enums/ac-type.enum.js';
import { FanSpeed } from '../../common/enums/fan-speed.enum.js';

export class SimulationConfigDto {
  @IsOptional()
  @IsEnum(AcType)
  acType?: AcType;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(1000)
  roomVolume?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-30)
  @Max(60)
  outsideTemperature?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-20)
  @Max(50)
  initialRoomTemperature?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(16)
  @Max(30)
  targetTemperature?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.1)
  @Max(30)
  ratedCoolingCapacity?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.1)
  @Max(30)
  ratedHeatingCapacity?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(100)
  @Max(20000)
  ratedPowerWatts?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(20)
  heatLoadKw?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.1)
  @Max(10)
  thermostatDifferential?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(120)
  simulationSpeed?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.1)
  @Max(100)
  thermalCapacityKwhPerC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(10)
  thermalConductanceKwPerC?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1000)
  fanPowerWatts?: number;

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
}

export class CreateSimulationDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsUUID()
  deviceId: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => SimulationConfigDto)
  config: SimulationConfigDto;
}