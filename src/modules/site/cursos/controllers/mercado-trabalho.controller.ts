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
import { MercadoTrabalhoService } from '../services/mercado-trabalho.service';
import { CriarMercadoTrabalhoDto } from '../dto/criar-mercado-trabalho.dto';
import { AtualizarMercadoTrabalhoDto } from '../dto/atualizar-mercado-trabalho.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

/**
 * 💼 Controller para mercado de trabalho
 */
@Controller('site/cursos/mercado-trabalho')
export class MercadoTrabalhoController {
  constructor(
    private readonly mercadoTrabalhoService: MercadoTrabalhoService,
  ) {}

  /**
   * 📋 Listar mercados com destaques (público)
   * GET /api/v1/site/cursos/mercado-trabalho
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.mercadoTrabalhoService.listarTodos();
  }

  /**
   * 🔍 Buscar mercado por ID com destaques (público)
   * GET /api/v1/site/cursos/mercado-trabalho/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.mercadoTrabalhoService.buscarPorId(id);
  }

  /**
   * ➕ Criar novo mercado (autenticado)
   * POST /api/v1/site/cursos/mercado-trabalho
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async criar(@Body() criarMercadoTrabalhoDto: CriarMercadoTrabalhoDto) {
    return this.mercadoTrabalhoService.criar(criarMercadoTrabalhoDto);
  }

  /**
   * ✏️ Atualizar mercado (autenticado)
   * PATCH /api/v1/site/cursos/mercado-trabalho/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarMercadoTrabalhoDto: AtualizarMercadoTrabalhoDto,
  ) {
    return this.mercadoTrabalhoService.atualizar(
      id,
      atualizarMercadoTrabalhoDto,
    );
  }

  /**
   * 🗑️ Remover mercado (autenticado)
   * DELETE /api/v1/site/cursos/mercado-trabalho/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    return this.mercadoTrabalhoService.remover(id);
  }
}
