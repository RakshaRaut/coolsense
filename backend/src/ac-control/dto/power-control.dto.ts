import { IsBoolean } from 'class-validator';

export class PowerControlDto {
  @IsBoolean()
  power: boolean;
}
