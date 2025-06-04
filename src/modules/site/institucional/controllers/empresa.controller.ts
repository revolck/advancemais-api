import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { EmpresaService } from '../services/empresa.service';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

/**
 * 🏢 Controller para gestão das informações da empresa
 */
@Controller('site/institucional/empresa')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  /**
   * 📋 Listar informações da empresa (público)
   * GET /api/v1/site/institucional/empresa
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.empresaService.listarTodos();
  }

  /**
   * 🔍 Buscar informação por ID (público)
   * GET /api/v1/site/institucional/empresa/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.empresaService.buscarPorId(id);
  }
}
