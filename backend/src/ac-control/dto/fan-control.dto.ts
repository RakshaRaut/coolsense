import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { FanSpeed } from '../../common/enums/fan-speed.enum.js';

export class FanControlDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(FanSpeed)
  fanSpeed: FanSpeed;
}
