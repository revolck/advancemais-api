import { randomUUID } from 'crypto';

import { Roles, StatusInscricao } from '@prisma/client';

import { prisma } from '@/config/prisma';
import { certificadosService } from '@/modules/cursos/services/certificados.service';

const CONTEUDO_HTML_EXEMPLO_1 = `
  <h2>Módulo 1</h2>
  <p><strong>Introdução</strong> ao curso e visão geral.</p>
  <ul>
    <li>Conceitos fundamentais</li>
    <li>Boas práticas</li>
  </ul>
`.trim();

const CONTEUDO_HTML_EXEMPLO_2 = `
  <h2>Módulo 2</h2>
  <p><em>Aplicações práticas</em> com exercícios guiados.</p>
  <ol>
    <li>Estudo de caso</li>
    <li>Projeto final</li>
  </ol>
`.trim();

async function main() {
  console.log('🚀 Gerando 2 certificados persistentes para validação manual...');

  const emissor = await prisma.usuarios.findFirst({
    where: { role: { in: [Roles.ADMIN, Roles.MODERADOR, Roles.PEDAGOGICO] } },
    select: { id: true, nomeCompleto: true, role: true },
    orderBy: { criadoEm: 'asc' },
  });

  const turmaCandidata = await prisma.cursosTurmas.findFirst({
    where: {
      Cursos: { estagioObrigatorio: false },
      CursosTurmasInscricoes: {
        some: {
          status: {
            notIn: [StatusInscricao.CANCELADO, StatusInscricao.REPROVADO, StatusInscricao.TRANCADO],
          },
        },
      },
    },
    select: {
      id: true,
      nome: true,
      cursoId: true,
      Cursos: { select: { id: true, nome: true } },
      CursosTurmasInscricoes: {
        where: {
          status: {
            notIn: [StatusInscricao.CANCELADO, StatusInscricao.REPROVADO, StatusInscricao.TRANCADO],
          },
          Usuarios: { role: Roles.ALUNO_CANDIDATO },
        },
        select: {
          id: true,
          alunoId: true,
          Usuarios: { select: { nomeCompleto: true, email: true } },
        },
        orderBy: { criadoEm: 'asc' },
        take: 10,
      },
    },
    orderBy: { criadoEm: 'asc' },
  });

  if (!turmaCandidata) {
    throw new Error(
      'Nenhuma turma elegível encontrada (curso sem estágio obrigatório e com inscrições ativas).',
    );
  }

  const alunosSelecionados = turmaCandidata.CursosTurmasInscricoes.slice(0, 2);
  if (alunosSelecionados.length < 2) {
    throw new Error(
      `A turma "${turmaCandidata.nome}" não possui ao menos 2 alunos ativos para emissão.`,
    );
  }

  const [alunoA, alunoB] = alunosSelecionados;

  const cert1 = await certificadosService.emitirGlobal(
    {
      cursoId: turmaCandidata.cursoId,
      turmaId: turmaCandidata.id,
      alunoId: alunoA.alunoId,
      modeloId: 'advance-plus-v1',
      forcarReemissao: true,
      conteudoProgramatico: CONTEUDO_HTML_EXEMPLO_1,
    },
    emissor?.id,
  );

  const cert2 = await certificadosService.emitirGlobal(
    {
      cursoId: turmaCandidata.cursoId,
      turmaId: turmaCandidata.id,
      alunoId: alunoB.alunoId,
      modeloId: 'advance-plus-v1',
      forcarReemissao: true,
      conteudoProgramatico: CONTEUDO_HTML_EXEMPLO_2,
    },
    emissor?.id,
  );

  console.log('\n✅ Certificados gerados com sucesso (dados mantidos no banco):\n');
  console.log([
    {
      certificadoId: cert1.data.id,
      codigo: cert1.data.codigo,
      aluno: alunoA.Usuarios.nomeCompleto,
      email: alunoA.Usuarios.email,
    },
    {
      certificadoId: cert2.data.id,
      codigo: cert2.data.codigo,
      aluno: alunoB.Usuarios.nomeCompleto,
      email: alunoB.Usuarios.email,
    },
  ]);

  const urlPreview1 = `/api/v1/cursos/certificados/${cert1.data.id}/preview`;
  const urlPreview2 = `/api/v1/cursos/certificados/${cert2.data.id}/preview`;
  console.log('\n🔎 Previews para validação manual:');
  console.log(`- ${urlPreview1}`);
  console.log(`- ${urlPreview2}`);

  console.log('\n📌 Contexto da turma usada:');
  console.log(
    `- Curso: ${turmaCandidata.Cursos.nome} (${turmaCandidata.Cursos.id}) | Turma: ${turmaCandidata.nome} (${turmaCandidata.id})`,
  );
  console.log(
    `- Emitido por: ${emissor?.nomeCompleto ?? 'sistema'} (${emissor?.role ?? 'N/A'}) | runId=${randomUUID().slice(0, 8)}`,
  );
}

main()
  .catch((error) => {
    console.error('\n❌ Falha ao gerar certificados de validação manual.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
