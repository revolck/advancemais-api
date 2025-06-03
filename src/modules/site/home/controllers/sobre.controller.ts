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
import { SobreService } from '../services/sobre.service';
import { CriarSobreDto } from '../dto/criar-sobre.dto';
import { AtualizarSobreDto } from '../dto/atualizar-sobre.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

@Controller('site/home/sobre')
export class SobreController {
  constructor(private readonly sobreService: SobreService) {}

  /**
   * 📋 Listar todas as seções sobre (público)
   * GET /api/v1/site/home/sobre
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.sobreService.listarTodos();
  }

  /**
   * 🔍 Buscar seção sobre por ID (público)
   * GET /api/v1/site/home/sobre/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.sobreService.buscarPorId(id);
  }

  /**
   * ➕ Criar nova seção sobre (autenticado)
   * POST /api/v1/site/home/sobre
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async criar(@Body() criarSobreDto: CriarSobreDto) {
    return this.sobreService.criar(criarSobreDto);
  }

  /**
   * ✏️ Atualizar seção sobre (autenticado)
   * PATCH /api/v1/site/home/sobre/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarSobreDto: AtualizarSobreDto,
  ) {
    return this.sobreService.atualizar(id, atualizarSobreDto);
  }

  /**
   * 🗑️ Remover seção sobre (autenticado)
   * DELETE /api/v1/site/home/sobre/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    return this.sobreService.remover(id);
  }

  /**
   * 🌱 Criar dados iniciais (autenticado)
   * POST /api/v1/site/home/sobre/seed
   */
  @UseGuards(JwtAuthGuard)
  @Post('seed')
  async criarDadosIniciais() {
    return this.sobreService.criarDadosIniciais();
  }
}
