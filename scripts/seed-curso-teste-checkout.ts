/**
 * Script para popular o banco com curso e turma de teste para checkout
 * 
 * Uso:
 *   npx tsx scripts/seed-curso-teste-checkout.ts
 */

import { prisma } from '../src/config/prisma';
import { logger } from '../src/utils/logger';

async function main() {
  logger.info('🌱 Iniciando seed de curso e turma para teste de checkout...');

  try {
    // 1. Verificar se já existe categoria
    let categoria = await prisma.cursosCategorias.findFirst({
      where: { nome: 'Tecnologia' },
    });

    if (!categoria) {
      logger.info('📁 Criando categoria de teste...');
      categoria = await prisma.cursosCategorias.create({
        data: {
          codCategoria: 'TEC001',
          nome: 'Tecnologia',
          descricao: 'Cursos de tecnologia e programação',
        },
      });
      logger.info(`✅ Categoria criada: ${categoria.nome} (ID: ${categoria.id})`);
    } else {
      logger.info(`✅ Categoria encontrada: ${categoria.nome} (ID: ${categoria.id})`);
    }

    // 2. Criar curso PAGO de teste
    logger.info('📚 Criando curso PAGO de teste...');
    const cursoPago = await prisma.cursos.create({
      data: {
        codigo: 'NODEJS2025',
        nome: 'Node.js Avançado - Do Zero ao Deploy',
        descricao:
          'Aprenda Node.js desde o básico até conceitos avançados. ' +
          'Inclui TypeScript, Express, Prisma, testes automatizados e deploy na AWS.',
        cargaHoraria: 80,
        categoriaId: categoria.id,
        imagemUrl: 'https://via.placeholder.com/800x600/00257d/ffffff?text=Node.js+Avancado',
        statusPadrao: 'PUBLICADO',
        estagioObrigatorio: false,
        // ✅ Campos de precificação (apenas o essencial)
        valor: 299.90,
        valorPromocional: 249.90,
        gratuito: false,
      },
    });
    logger.info(`✅ Curso PAGO criado: ${cursoPago.nome} (ID: ${cursoPago.id})`);
    logger.info(`   💰 Valor: R$ ${cursoPago.valor}`);
    logger.info(`   🎁 Valor Promocional: R$ ${cursoPago.valorPromocional}`);

    // 3. Criar curso GRATUITO de teste
    logger.info('📚 Criando curso GRATUITO de teste...');
    const cursoGratuito = await prisma.cursos.create({
      data: {
        codigo: 'INTRO2025',
        nome: 'Introdução à Programação - Gratuito',
        descricao:
          'Curso introdutório totalmente gratuito para quem está começando na programação. ' +
          'Aprenda os fundamentos da lógica de programação.',
        cargaHoraria: 20,
        categoriaId: categoria.id,
        imagemUrl: 'https://via.placeholder.com/800x600/00d4ff/000000?text=Intro+Programacao',
        statusPadrao: 'PUBLICADO',
        estagioObrigatorio: false,
        // ✅ Campos de precificação (GRATUITO)
        valor: 0,
        gratuito: true,
      },
    });
    logger.info(`✅ Curso GRATUITO criado: ${cursoGratuito.nome} (ID: ${cursoGratuito.id})`);

    // 4. Criar turmas para o curso pago
    logger.info('👥 Criando turmas para o curso pago...');
    const turma1 = await prisma.cursosTurmas.create({
      data: {
        cursoId: cursoPago.id,
        nome: 'Turma 01/2025 - Noturno',
        descricao: 'Turma noturna - Segunda a Sexta, 19h às 22h',
        dataInicio: new Date('2025-02-01'),
        dataFim: new Date('2025-05-31'),
        limiteAlunos: 30,
        ativo: true,
        statusTurma: 'ABERTA',
      },
    });
    logger.info(`✅ Turma 1 criada: ${turma1.nome} (ID: ${turma1.id})`);
    logger.info(`   📅 Início: ${turma1.dataInicio?.toLocaleDateString('pt-BR')}`);
    logger.info(`   👤 Limite: ${turma1.limiteAlunos} alunos`);

    const turma2 = await prisma.cursosTurmas.create({
      data: {
        cursoId: cursoPago.id,
        nome: 'Turma 02/2025 - Manhã',
        descricao: 'Turma matutina - Segunda a Sexta, 9h às 12h',
        dataInicio: new Date('2025-03-01'),
        dataFim: new Date('2025-06-30'),
        limiteAlunos: 25,
        ativo: true,
        statusTurma: 'ABERTA',
      },
    });
    logger.info(`✅ Turma 2 criada: ${turma2.nome} (ID: ${turma2.id})`);

    // 5. Criar turma para o curso gratuito
    logger.info('👥 Criando turma para o curso gratuito...');
    const turmaGratuita = await prisma.cursosTurmas.create({
      data: {
        cursoId: cursoGratuito.id,
        nome: 'Turma 01/2025 - Livre',
        descricao: 'Turma com acesso livre e ilimitado',
        dataInicio: new Date('2025-01-15'),
        dataFim: new Date('2025-12-31'),
        limiteAlunos: null, // Sem limite
        ativo: true,
        statusTurma: 'ABERTA',
      },
    });
    logger.info(`✅ Turma GRATUITA criada: ${turmaGratuita.nome} (ID: ${turmaGratuita.id})`);
    logger.info(`   📅 Acesso: Ilimitado até ${turmaGratuita.dataFim?.toLocaleDateString('pt-BR')}`);

    // 6. Criar cupom de desconto de teste
    logger.info('🎟️  Criando cupom de desconto de teste...');
    
    // Buscar ou criar usuário admin para o cupom
    let usuarioAdmin = await prisma.usuarios.findFirst({
      where: {
        OR: [
          { role: 'ADMINISTRADOR' },
          { role: 'SUPER_ADMINISTRADOR' },
        ],
      },
    });

    if (!usuarioAdmin) {
      logger.warn('⚠️  Nenhum usuário admin encontrado, pulando criação de cupom');
    } else {
      const cupom = await prisma.cuponsDesconto.create({
        data: {
          codigo: 'TESTE10',
          descricao: 'Cupom de teste - 10% de desconto',
          tipoDesconto: 'PORCENTAGEM',
          valorPorcentagem: 10,
          valorFixo: null,
          aplicarEm: 'APENAS_CURSOS',
          aplicarEmTodosItens: true,
          limiteUsoTotalTipo: 'ILIMITADO',
          limitePorUsuarioTipo: 'ILIMITADO',
          periodoTipo: 'ILIMITADO',
          usosTotais: 0,
          status: 'PUBLICADO',
          criadoPorId: usuarioAdmin.id,
        },
      });
      logger.info(`✅ Cupom criado: ${cupom.codigo} (${cupom.valorPorcentagem}% de desconto)`);
    }

    // 7. Resumo final
    logger.info('\n📊 RESUMO DO SEED:');
    logger.info('════════════════════════════════════════════════');
    logger.info(`✅ Categoria: ${categoria.nome} (ID: ${categoria.id})`);
    logger.info('\n📚 CURSOS:');
    logger.info(`   💰 PAGO: ${cursoPago.nome}`);
    logger.info(`      • ID: ${cursoPago.id}`);
    logger.info(`      • Código: ${cursoPago.codigo}`);
    logger.info(`      • Valor: R$ ${cursoPago.valor}`);
    logger.info(`      • Turmas: 2`);
    logger.info(`   🆓 GRATUITO: ${cursoGratuito.nome}`);
    logger.info(`      • ID: ${cursoGratuito.id}`);
    logger.info(`      • Código: ${cursoGratuito.codigo}`);
    logger.info(`      • Turmas: 1`);
    logger.info('\n👥 TURMAS:');
    logger.info(`   1. ${turma1.nome} (ID: ${turma1.id}) - ${turma1.limiteAlunos} vagas`);
    logger.info(`   2. ${turma2.nome} (ID: ${turma2.id}) - ${turma2.limiteAlunos} vagas`);
    logger.info(`   3. ${turmaGratuita.nome} (ID: ${turmaGratuita.id}) - Ilimitado`);
    logger.info('════════════════════════════════════════════════\n');

    logger.info('🎯 COMANDOS PARA TESTAR O CHECKOUT:\n');
    logger.info('# 1. Verificar vagas na turma:');
    logger.info(`   GET /api/v1/cursos/${cursoPago.id}/turmas/${turma1.id}/vagas\n`);
    logger.info('# 2. Checkout de curso GRATUITO:');
    logger.info(`   POST /api/v1/cursos/checkout`);
    logger.info(`   Body: { "usuarioId": "<seu_usuario>", "cursoId": "${cursoGratuito.id}", "turmaId": "${turmaGratuita.id}", "pagamento": "pix", "aceitouTermos": true }\n`);
    logger.info('# 3. Checkout de curso PAGO com PIX:');
    logger.info(`   POST /api/v1/cursos/checkout`);
    logger.info(`   Body: { "usuarioId": "<seu_usuario>", "cursoId": "${cursoPago.id}", "turmaId": "${turma1.id}", "pagamento": "pix", "aceitouTermos": true, "payer": { "identification": { "type": "CPF", "number": "12345678901" } } }\n`);
    logger.info('# 4. Checkout com CUPOM:');
    logger.info(`   Body: { ..., "cupomCodigo": "TESTE10" }\n`);

    logger.info('✅ Seed concluído com sucesso!');
  } catch (error) {
    logger.error('❌ Erro ao executar seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

