/**
 * Script para validar o bug do nomeCompleto retornando UUID
 * Executa diretamente no banco de dados
 */

import { prisma } from '../src/config/prisma';
import { Roles } from '@prisma/client';

async function testCandidatosOverview() {
  console.log('\n🔍 Testando dados dos candidatos no banco de dados...\n');

  // 1. Buscar candidatos diretamente do banco
  const candidatos = await prisma.usuarios.findMany({
    where: {
      role: Roles.ALUNO_CANDIDATO,
    },
    take: 5,
    select: {
      id: true,
      nomeCompleto: true,
      email: true,
      codUsuario: true,
    },
  });

  console.log('📋 Candidatos no banco de dados:');
  console.log('─'.repeat(80));
  candidatos.forEach((c, i) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      c.nomeCompleto,
    );
    console.log(`${i + 1}. ID: ${c.id}`);
    console.log(`   nomeCompleto: ${c.nomeCompleto} ${isUUID ? '❌ É UM UUID!' : '✅ OK'}`);
    console.log(`   email: ${c.email}`);
    console.log('─'.repeat(80));
  });

  // 2. Verificar se existe alguma candidatura
  const candidaturas = await prisma.empresasCandidatos.findMany({
    take: 5,
    include: {
      Usuarios_EmpresasCandidatos_candidatoIdToUsuarios: {
        select: {
          id: true,
          nomeCompleto: true,
          email: true,
        },
      },
      EmpresasVagas: {
        select: {
          id: true,
          titulo: true,
        },
      },
    },
  });

  console.log('\n📋 Candidaturas no banco (com dados do candidato):');
  console.log('═'.repeat(80));

  if (candidaturas.length === 0) {
    console.log('⚠️  Nenhuma candidatura encontrada no banco de dados');
    console.log('   O bug pode não ser reproduzível sem dados de candidatura.');
  } else {
    candidaturas.forEach((cand, i) => {
      const candidato = cand.Usuarios_EmpresasCandidatos_candidatoIdToUsuarios;
      const isUUID =
        candidato &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          candidato.nomeCompleto,
        );

      console.log(`${i + 1}. Candidatura ID: ${cand.id}`);
      console.log(`   Candidato ID: ${cand.candidatoId}`);
      console.log(
        `   Nome no banco: ${candidato?.nomeCompleto ?? 'N/A'} ${isUUID ? '❌ É UM UUID!' : '✅ OK'}`,
      );
      console.log(`   Email: ${candidato?.email ?? 'N/A'}`);
      console.log(`   Vaga: ${cand.EmpresasVagas?.titulo ?? 'N/A'}`);
      console.log('─'.repeat(80));
    });
  }

  // 3. Query SQL direta para comparar
  console.log('\n📊 Query SQL direta:');
  console.log('═'.repeat(80));

  const sqlResult = await prisma.$queryRaw<
    { id: string; nomeCompleto: string; email: string }[]
  >`
    SELECT id, "nomeCompleto", email 
    FROM "Usuarios" 
    WHERE role = 'ALUNO_CANDIDATO' 
    LIMIT 5
  `;

  sqlResult.forEach((r, i) => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      r.nomeCompleto,
    );
    console.log(`${i + 1}. ${r.id}`);
    console.log(`   nomeCompleto: ${r.nomeCompleto} ${isUUID ? '❌ É UM UUID!' : '✅ OK'}`);
    console.log(`   email: ${r.email}`);
  });

  console.log('\n✅ Teste concluído!');
  console.log('\n📌 RESUMO:');
  console.log('   Se todos os nomes aparecem como ✅ OK, o bug NÃO está no backend.');
  console.log('   Se algum nome aparece como ❌ É UM UUID!, há um problema de dados.');
}

testCandidatosOverview()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
