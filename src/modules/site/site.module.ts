import { Module } from '@nestjs/common';
import { HomeModule } from './home/home.module';
import { SobreModule } from './sobre/sobre.module';
import { CursosModule } from './cursos/cursos.module';

@Module({
  imports: [HomeModule, SobreModule, CursosModule],
  exports: [HomeModule, SobreModule, CursosModule],
})
export class SiteModule {}
