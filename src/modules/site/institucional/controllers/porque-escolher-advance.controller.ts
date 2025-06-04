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
import { PorqueEscolherAdvanceService } from '../services/porque-escolher-advance.service';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

/**
 * ⭐ Controller para "Por que escolher a Advance"
 */
@Controller('site/institucional/porque-escolher-advance')
export class PorqueEscolherAdvanceController {
  constructor(
    private readonly porqueEscolherAdvanceService: PorqueEscolherAdvanceService,
  ) {}

  /**
   * 📋 Listar seções com boxes (público)
   * GET /api/v1/site/institucional/porque-escolher-advance
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.porqueEscolherAdvanceService.listarTodos();
  }

  /**
   * 🔍 Buscar seção por ID com boxes (público)
   * GET /api/v1/site/institucional/porque-escolher-advance/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.porqueEscolherAdvanceService.buscarPorId(id);
  }
}
