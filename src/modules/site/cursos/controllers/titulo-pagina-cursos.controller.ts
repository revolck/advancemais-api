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
import { TituloPaginaCursosService } from '../services/titulo-pagina-cursos.service';
import { CriarTituloPaginaCursosDto } from '../dto/criar-titulo-pagina-cursos.dto';
import { AtualizarTituloPaginaCursosDto } from '../dto/atualizar-titulo-pagina-cursos.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { Public } from '../../../../common/decorators/auth.decorator';

/**
 * 📚 Controller para títulos da página de cursos
 */
@Controller('site/cursos/titulos-pagina')
export class TituloPaginaCursosController {
  constructor(
    private readonly tituloPaginaCursosService: TituloPaginaCursosService,
  ) {}

  /**
   * 📋 Listar todos os títulos (público)
   * GET /api/v1/site/cursos/titulos-pagina
   */
  @Public()
  @Get()
  async listarTodos() {
    return this.tituloPaginaCursosService.listarTodos();
  }

  /**
   * 🔍 Buscar título por ID (público)
   * GET /api/v1/site/cursos/titulos-pagina/:id
   */
  @Public()
  @Get(':id')
  async buscarPorId(@Param('id', ParseIntPipe) id: number) {
    return this.tituloPaginaCursosService.buscarPorId(id);
  }

  /**
   * ➕ Criar novo título (autenticado)
   * POST /api/v1/site/cursos/titulos-pagina
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async criar(@Body() criarTituloPaginaCursosDto: CriarTituloPaginaCursosDto) {
    return this.tituloPaginaCursosService.criar(criarTituloPaginaCursosDto);
  }

  /**
   * ✏️ Atualizar título (autenticado)
   * PATCH /api/v1/site/cursos/titulos-pagina/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() atualizarTituloPaginaCursosDto: AtualizarTituloPaginaCursosDto,
  ) {
    return this.tituloPaginaCursosService.atualizar(
      id,
      atualizarTituloPaginaCursosDto,
    );
  }

  /**
   * 🗑️ Remover título (autenticado)
   * DELETE /api/v1/site/cursos/titulos-pagina/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remover(@Param('id', ParseIntPipe) id: number) {
    return this.tituloPaginaCursosService.remover(id);
  }
}
