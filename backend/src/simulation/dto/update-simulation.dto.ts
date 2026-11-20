import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { AcMode } from '../../common/enums/ac-mode.enum.js';
import { FanSpeed } from '../../common/enums/fan-speed.enum.js';

export class UpdateSimulationDto {
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
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-30)
  @Max(60)
  ambientTemperature?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(120)
  simulationSpeed?: number;
}