import { IsEnum } from 'class-validator';
import { AcMode } from '../../common/enums/ac-mode.enum.js';

export class ModeControlDto {
  @IsEnum(AcMode)
  mode: AcMode;
}
