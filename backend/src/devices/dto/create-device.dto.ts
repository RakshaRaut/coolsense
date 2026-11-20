import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { DeviceConfigurationDto } from './device-configuration.dto.js';

export class CreateDeviceDto extends DeviceConfigurationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
}
