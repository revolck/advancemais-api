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
import { InformacaoAdvanceService } from '../services/informacao-advance.service';
import { CriarInformacaoAdvanceDto } from '../dto/criar-informacao-advance.dto';
import { AtualizarInformacaoAdvanceDto } from '../dto/atualizar-informacao-advance.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

/**
 * 📊 Controller para gestão das informações da Advance
 */
@Controller('site/institucional/informacao-advance')
export class InformacaoAdvanceController {
  constructor(
    private readonly informacaoAdvanceService: InformacaoAdvanceService,
  ) {}

  /**
   * 📋 Listar todas as informações (público)
   * GET /api/v1/site/institucional/informacao-advance
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.informacaoAdvanceService.listarTodos();
  }

  /**
   * 🔍 Buscar informação por ID (público)
   * GET /api/v1/site/institucional/informacao-advance/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.informacaoAdvanceService.buscarPorId(id);
  }

  /**
   * ➕ Criar nova informação (autenticado)
   * POST /api/v1/site/institucional/informacao-advance
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async criar(@Body() criarInformacaoAdvanceDto: CriarInformacaoAdvanceDto) {
    return this.informacaoAdvanceService.criar(criarInformacaoAdvanceDto);
  }

  /**
   * ✏️ Atualizar informação (autenticado)
   * PATCH /api/v1/site/institucional/informacao-advance/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarInformacaoAdvanceDto: AtualizarInformacaoAdvanceDto,
  ) {
    return this.informacaoAdvanceService.atualizar(
      id,
      atualizarInformacaoAdvanceDto,
    );
  }

  /**
   * 🗑️ Remover informação (autenticado)
   * DELETE /api/v1/site/institucional/informacao-advance/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    return this.informacaoAdvanceService.remover(id);
  }
}
