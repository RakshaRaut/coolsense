import { IsNumber, Max, Min } from 'class-validator';

export class TemperatureControlDto {
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(16)
  @Max(30)
  targetTemperature: number;
}
