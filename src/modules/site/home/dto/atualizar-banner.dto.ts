import { PartialType } from '@nestjs/mapped-types';
import { CriarBannerDto } from './criar-banner.dto';

export class AtualizarBannerDto extends PartialType(CriarBannerDto) {}
