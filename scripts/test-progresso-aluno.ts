/**
 * Script para testar e mostrar o campo progresso nas inscrições do aluno
 */

import { PrismaClient } from '@prisma/client';
import { generateTokenPair } from '@/modules/usuarios/utils/auth';
import { Roles } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Analisando campo PROGRESSO nas inscrições do aluno...\n');

  try {
    // 1. Buscar usuário admin do seed
    const admin = await prisma.usuarios.findFirst({
      where: {
        role: Roles.ADMIN,
        status: 'ATIVO',
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
      },
    });

    if (!admin) {
      console.log('❌ Nenhum usuário admin encontrado');
      return;
    }

    // 2. Buscar um aluno com inscrições
    const aluno = await prisma.usuarios.findFirst({
      where: {
        role: Roles.ALUNO_CANDIDATO,
        status: 'ATIVO',
      },
      include: {
        CursosTurmasInscricoes: {
          take: 3,
          include: {
            CursosTurmas: {
              include: {
                Cursos: {
                  select: {
                    id: true,
                    nome: true,
                    codigo: true,
                    descricao: true,
                    cargaHoraria: true,
                    imagemUrl: true,
                  },
                },
              },
            },
          },
          orderBy: {
            criadoEm: 'desc',
          },
        },
      },
    });

    if (!aluno || aluno.CursosTurmasInscricoes.length === 0) {
      console.log('❌ Nenhum aluno com inscrições encontrado');
      return;
    }

    console.log('✅ Aluno encontrado:');
    console.log(`   Nome: ${aluno.nomeCompleto}`);
    console.log(`   Email: ${aluno.email}`);
    console.log(`   ID: ${aluno.id}`);
    console.log(`   Total de inscrições: ${aluno.CursosTurmasInscricoes.length}\n`);

    // Gerar token para fazer requisição
    const tokens = generateTokenPair(admin.id, admin.role, { rememberMe: false });
    const token = tokens.accessToken;

    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/v1/cursos/alunos/${aluno.id}`;

    console.log('📡 Fazendo requisição para:', url);
    console.log('⏳ Aguardando resposta...\n');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Erro na requisição: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Resposta:', errorText);
      return;
    }

    const result = await response.json();

    console.log('═'.repeat(80));
    console.log('📊 RESPOSTA COMPLETA DO ENDPOINT GET /api/v1/cursos/alunos/{alunoId}');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('═'.repeat(80));

    // Análise específica do campo progresso
    if (result.data && result.data.inscricoes && result.data.inscricoes.length > 0) {
      console.log('\n🔍 ANÁLISE DETALHADA DO CAMPO PROGRESSO:\n');

      result.data.inscricoes.forEach((inscricao: any, index: number) => {
        console.log(`\n📚 Inscrição ${index + 1}:`);
        console.log(`   ID: ${inscricao.id}`);
        console.log(`   Status: ${inscricao.statusInscricao}`);
        console.log(`   Curso: ${inscricao.curso?.nome || 'N/A'}`);
        console.log(`   Turma: ${inscricao.turma?.nome || 'N/A'}`);
        console.log(`   PROGRESSO: ${inscricao.progresso ?? 'null/undefined'}`);
        console.log(`   Tipo: ${typeof inscricao.progresso}`);
        console.log(
          `   Unidade: ${typeof inscricao.progresso === 'number' ? '0-100 (percentual)' : 'N/A'}`,
        );
        console.log(
          `   Data de inscrição: ${inscricao.criadoEm || inscricao.dataInscricao || 'N/A'}`,
        );

        // Mostrar estrutura completa
        console.log(`\n   📋 Estrutura completa da inscrição:`);
        console.log(`   ${JSON.stringify(inscricao, null, 2).split('\n').join('\n   ')}`);
      });

      console.log('\n\n📋 RESUMO:');
      console.log('═'.repeat(80));
      console.log('1. UNIDADE DO PROGRESSO:');
      const primeiroProgresso = result.data.inscricoes[0]?.progresso;
      if (typeof primeiroProgresso === 'number') {
        console.log('   ✅ Progresso é um NUMBER (0-100) - Percentual');
        console.log('   Exemplo:', primeiroProgresso);
        if (primeiroProgresso >= 0 && primeiroProgresso <= 100) {
          console.log('   ✅ Confirmado: valor entre 0 e 100 (percentual)');
        } else {
          console.log('   ⚠️  ATENÇÃO: valor fora do range 0-100');
        }
      } else if (primeiroProgresso === null || primeiroProgresso === undefined) {
        console.log('   ⚠️  Progresso pode ser null/undefined');
      } else {
        console.log('   ❌ Progresso não é um número:', typeof primeiroProgresso);
      }

      console.log('\n2. QUANDO PROGRESSO É NULL/UNDEFINED:');
      const inscricoesSemProgresso = result.data.inscricoes.filter(
        (i: any) => i.progresso === null || i.progresso === undefined,
      );
      if (inscricoesSemProgresso.length > 0) {
        console.log(`   ⚠️  ${inscricoesSemProgresso.length} inscrição(ões) sem progresso:`);
        inscricoesSemProgresso.forEach((insc: any) => {
          console.log(`      - ${insc.id} (${insc.statusInscricao})`);
        });
      } else {
        console.log('   ✅ Todas as inscrições têm progresso calculado');
      }

      console.log('\n3. CAMPOS DISPONÍVEIS EM CADA INSCRIÇÃO:');
      const exemplo = result.data.inscricoes[0];
      console.log('   Campos retornados:');
      Object.keys(exemplo).forEach((key) => {
        const value = exemplo[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const nullable = value === null || value === undefined;
        console.log(`      - ${key}: ${type}${nullable ? ' (nullable)' : ''}`);
      });
    }

    // Testar também o endpoint de histórico
    console.log('\n\n🔍 TESTANDO ENDPOINT DE HISTÓRICO:');
    console.log('═'.repeat(80));
    const historicoUrl = `${baseUrl}/api/v1/cursos/alunos/${aluno.id}/inscricoes?page=1&pageSize=10`;

    const historicoResponse = await fetch(historicoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (historicoResponse.ok) {
      const historicoResult = await historicoResponse.json();
      console.log('\n📊 RESPOSTA DO ENDPOINT GET /api/v1/cursos/alunos/{alunoId}/inscricoes:');
      console.log(JSON.stringify(historicoResult, null, 2));

      if (historicoResult.data && historicoResult.data.length > 0) {
        console.log('\n✅ Progresso também está disponível no endpoint de histórico!');
        const exemploHistorico = historicoResult.data[0];
        if (exemploHistorico.progresso !== undefined) {
          console.log(`   Progresso no histórico: ${exemploHistorico.progresso}`);
          console.log(`   Tipo: ${typeof exemploHistorico.progresso}`);
        }
      }
    } else {
      console.log(`❌ Erro ao buscar histórico: ${historicoResponse.status}`);
    }
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
