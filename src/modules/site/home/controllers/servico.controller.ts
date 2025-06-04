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
  Query,
} from '@nestjs/common';
import { ServicoService } from '../services/servico.service';
import { CriarServicoDto } from '../dto/criar-servico.dto';
import { AtualizarServicoDto } from '../dto/atualizar-servico.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';
import { TipoServico } from '@prisma/client';

/**
 * 🛠️ Controller para gestão de serviços
 */
@Controller('site/home/servicos')
export class ServicoController {
  constructor(private readonly servicoService: ServicoService) {}

  /**
   * 📋 Listar todos os serviços ativos (público)
   * GET /api/v1/site/home/servicos
   */
  @Public()
  @Get()
  async listarTodos(@Query('tipo') tipo?: TipoServico) {
    return this.servicoService.listarTodos(tipo);
  }

  /**
   * 🔍 Buscar serviço por ID (público)
   * GET /api/v1/site/home/servicos/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.servicoService.buscarPorId(id);
  }

  /**
   * ➕ Criar novo serviço (autenticado)
   * POST /api/v1/site/home/servicos
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async criar(@Body() criarServicoDto: CriarServicoDto) {
    return this.servicoService.criar(criarServicoDto);
  }

  /**
   * ✏️ Atualizar serviço (autenticado)
   * PATCH /api/v1/site/home/servicos/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarServicoDto: AtualizarServicoDto,
  ) {
    return this.servicoService.atualizar(id, atualizarServicoDto);
  }

  /**
   * 🗑️ Remover serviço (autenticado)
   * DELETE /api/v1/site/home/servicos/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    return this.servicoService.remover(id);
  }
}
