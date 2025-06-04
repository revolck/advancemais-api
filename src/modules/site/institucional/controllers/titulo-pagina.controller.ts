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
import { TituloPaginaService } from '../services/titulo-pagina.service';
import { CriarTituloPaginaDto } from '../dto/criar-titulo-pagina.dto';
import { AtualizarTituloPaginaDto } from '../dto/atualizar-titulo-pagina.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

/**
 * 📄 Controller para gestão de títulos de páginas
 */
@Controller('site/institucional/titulos-pagina')
export class TituloPaginaController {
  constructor(private readonly tituloPaginaService: TituloPaginaService) {}

  /**
   * 📋 Listar todos os títulos (público)
   * GET /api/v1/site/institucional/titulos-pagina
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.tituloPaginaService.listarTodos();
  }

  /**
   * 🔍 Buscar título por ID (público)
   * GET /api/v1/site/institucional/titulos-pagina/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.tituloPaginaService.buscarPorId(id);
  }

  /**
   * ➕ Criar novo título (autenticado)
   * POST /api/v1/site/institucional/titulos-pagina
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async criar(@Body() criarTituloPaginaDto: CriarTituloPaginaDto) {
    return this.tituloPaginaService.criar(criarTituloPaginaDto);
  }

  /**
   * ✏️ Atualizar título (autenticado)
   * PATCH /api/v1/site/institucional/titulos-pagina/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarTituloPaginaDto: AtualizarTituloPaginaDto,
  ) {
    return this.tituloPaginaService.atualizar(id, atualizarTituloPaginaDto);
  }

  /**
   * 🗑️ Remover título (autenticado)
   * DELETE /api/v1/site/institucional/titulos-pagina/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    return this.tituloPaginaService.remover(id);
  }
}
