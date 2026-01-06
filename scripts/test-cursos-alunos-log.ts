/**
 * Script para testar a rota /api/v1/cursos/alunos e mostrar os dados retornados
 */

import { PrismaClient } from '@prisma/client';
import { generateTokenPair } from '@/modules/usuarios/utils/auth';
import { Roles } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Testando rota /api/v1/cursos/alunos...\n');

  try {
    // Buscar usuário admin do seed
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

    console.log('✅ Usuário admin encontrado:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Nome: ${admin.nomeCompleto}`);
    console.log(`   Role: ${admin.role}\n`);

    // Gerar token
    const tokens = generateTokenPair(admin.id, admin.role, { rememberMe: false });
    const token = tokens.accessToken;

    console.log('📡 Fazendo requisição para /api/v1/cursos/alunos?page=1&limit=10\n');

    // Fazer requisição HTTP
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/v1/cursos/alunos?page=1&limit=10`;

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

    const data = await response.json();

    console.log('✅ Resposta recebida com sucesso!\n');
    console.log('═'.repeat(80));
    console.log('📊 ESTRUTURA DA RESPOSTA:');
    console.log('═'.repeat(80));
    console.log(JSON.stringify(data, null, 2));
    console.log('═'.repeat(80));

    // Análise detalhada
    console.log('\n📈 ANÁLISE DOS DADOS:\n');
    console.log(`Total de alunos: ${data.pagination?.total || 0}`);
    console.log(`Página atual: ${data.pagination?.page || 'N/A'}`);
    console.log(`Itens por página: ${data.pagination?.pageSize || 'N/A'}`);
    console.log(`Total de páginas: ${data.pagination?.totalPages || 'N/A'}`);
    console.log(`Alunos retornados nesta página: ${data.data?.length || 0}\n`);

    if (data.data && data.data.length > 0) {
      console.log('👥 EXEMPLO DE ALUNO (primeiro da lista):\n');
      const primeiroAluno = data.data[0];
      console.log(JSON.stringify(primeiroAluno, null, 2));
      console.log('\n');

      // Estatísticas
      const alunosComCurso = data.data.filter((a: any) => a.ultimoCurso !== null).length;
      const alunosSemCurso = data.data.length - alunosComCurso;

      console.log('📊 ESTATÍSTICAS:');
      console.log(`   Alunos com curso ativo: ${alunosComCurso}`);
      console.log(`   Alunos sem curso ativo: ${alunosSemCurso}`);

      // Status de inscrição
      const statusCount: Record<string, number> = {};
      data.data.forEach((aluno: any) => {
        if (aluno.ultimoCurso?.statusInscricao) {
          statusCount[aluno.ultimoCurso.statusInscricao] =
            (statusCount[aluno.ultimoCurso.statusInscricao] || 0) + 1;
        }
      });

      if (Object.keys(statusCount).length > 0) {
        console.log('\n📋 DISTRIBUIÇÃO POR STATUS DE INSCRIÇÃO:');
        Object.entries(statusCount).forEach(([status, count]) => {
          console.log(`   ${status}: ${count}`);
        });
      }

      // Cidades
      const cidades = data.data
        .map((a: any) => a.cidade)
        .filter((c: any) => c !== null && c !== undefined);
      const cidadesUnicas = [...new Set(cidades)];

      if (cidadesUnicas.length > 0) {
        console.log('\n🏙️  CIDADES ENCONTRADAS:');
        cidadesUnicas.forEach((cidade) => {
          const count = cidades.filter((c: any) => c === cidade).length;
          console.log(`   ${cidade}: ${count} aluno(s)`);
        });
      }
    } else {
      console.log('⚠️  Nenhum aluno retornado na resposta');
    }
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
