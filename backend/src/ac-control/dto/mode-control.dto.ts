import { Transform } from 'class-transformer';
import { IsEnum } from 'class-validator';
import { AcMode } from '../../common/enums/ac-mode.enum.js';

export class ModeControlDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(AcMode)
  mode: AcMode;
}
