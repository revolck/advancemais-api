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
import { BannerService } from '../services/banner.service';
import { CriarBannerDto } from '../dto/criar-banner.dto';
import { AtualizarBannerDto } from '../dto/atualizar-banner.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

/**
 * 🖼️ Controller para gestão de banners da página inicial
 */
@Controller('site/home/banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  /**
   * 📋 Listar todos os banners ativos (público)
   * GET /api/v1/site/home/banners
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.bannerService.listarTodos();
  }

  /**
   * 🔍 Buscar banner por ID (público)
   * GET /api/v1/site/home/banners/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.buscarPorId(id);
  }

  /**
   * ➕ Criar novo banner (autenticado)
   * POST /api/v1/site/home/banners
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async criar(@Body() criarBannerDto: CriarBannerDto) {
    return this.bannerService.criar(criarBannerDto);
  }

  /**
   * ✏️ Atualizar banner (autenticado)
   * PATCH /api/v1/site/home/banners/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarBannerDto: AtualizarBannerDto,
  ) {
    return this.bannerService.atualizar(id, atualizarBannerDto);
  }

  /**
   * 🗑️ Remover banner (autenticado)
   * DELETE /api/v1/site/home/banners/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    return this.bannerService.remover(id);
  }
}
