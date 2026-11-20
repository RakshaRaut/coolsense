import { IsEnum } from 'class-validator';
import { FanSpeed } from '../../common/enums/fan-speed.enum.js';

export class FanControlDto {
  @IsEnum(FanSpeed)
  fanSpeed: FanSpeed;
}
