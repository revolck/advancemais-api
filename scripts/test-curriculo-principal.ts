/**
 * Script para testar a regra de currículo principal
 *
 * Testa:
 * 1. Criar primeiro currículo (deve ser principal automaticamente)
 * 2. Criar segundo currículo marcando como principal
 * 3. Listar currículos e verificar que apenas 1 é principal
 * 4. Tentar desmarcar o único principal (deve retornar erro)
 * 5. Excluir currículo principal (deve promover outro)
 */

import { PrismaClient, Roles } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const prisma = new PrismaClient();

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function getCandidatoToken() {
  log('\n🔐 Fazendo login como candidato...', 'cyan');

  try {
    // Fazer login via API
    const loginResponse = await axios.post(
      `${API_BASE_URL}/api/v1/auth/sign-in`,
      {
        email: 'joao.silva@example.com',
        password: 'Candidato@123',
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const { token, user } = loginResponse.data;

    log(`✅ Login realizado: ${user.nomeCompleto} (${user.email})`, 'green');

    return { candidato: user, token };
  } catch (error: any) {
    log('❌ Erro no login - tentando obter usuário do banco...', 'yellow');

    // Fallback: buscar usuário no banco
    const candidato = await prisma.usuarios.findFirst({
      where: {
        email: 'joao.silva@example.com',
        role: Roles.ALUNO_CANDIDATO,
        status: 'ATIVO',
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        role: true,
        authId: true,
      },
    });

    if (!candidato) {
      throw new Error('Candidato não encontrado');
    }

    log(`✅ Candidato encontrado: ${candidato.nomeCompleto} (${candidato.email})`, 'green');

    const token = jwt.sign(
      {
        sub: candidato.id,
        id: candidato.id,
        email: candidato.email,
        role: candidato.role,
        authId: candidato.authId,
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    return { candidato, token };
  }
}

async function limparCurriculos(usuarioId: string) {
  log('\n🧹 Limpando currículos existentes...', 'yellow');

  await prisma.usuariosCurriculos.deleteMany({
    where: { usuarioId },
  });

  log('✅ Currículos removidos', 'green');
}

async function listarCurriculos(token: string) {
  const response = await axios.get(`${API_BASE_URL}/api/v1/candidatos/curriculos`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}

async function criarCurriculo(token: string, data: any) {
  const response = await axios.post(`${API_BASE_URL}/api/v1/candidatos/curriculos`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

async function atualizarCurriculo(token: string, id: string, data: any) {
  const response = await axios.put(`${API_BASE_URL}/api/v1/candidatos/curriculos/${id}`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

async function excluirCurriculo(token: string, id: string) {
  await axios.delete(`${API_BASE_URL}/api/v1/candidatos/curriculos/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function verificarPrincipais(curriculos: any[]) {
  const principais = curriculos.filter((c: any) => c.principal === true);

  log(`\n📊 Verificando currículos principais:`, 'cyan');
  log(`   Total de currículos: ${curriculos.length}`);
  log(`   Currículos principais: ${principais.length}`);

  curriculos.forEach((c: any) => {
    const badge = c.principal ? '⭐ PRINCIPAL' : '   secundário';
    log(`   ${badge} - ${c.titulo || 'Sem título'} (${c.id.substring(0, 8)}...)`);
  });

  return principais.length;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  log('🧪 TESTE: Regra de Currículo Principal', 'blue');
  console.log('='.repeat(80));

  try {
    // 1. Obter token
    const { candidato, token } = await getCandidatoToken();

    // 2. Limpar currículos existentes
    await limparCurriculos(candidato.id);

    // 3. TESTE 1: Criar primeiro currículo
    log('\n📝 TESTE 1: Criar primeiro currículo', 'blue');
    log('Esperado: Deve ser marcado como principal automaticamente');

    const curriculo1 = await criarCurriculo(token, {
      titulo: 'Meu Primeiro Currículo',
      resumo: 'Desenvolvedor Full Stack',
      objetivo: 'Busco oportunidades na área de tecnologia',
    });

    if (curriculo1.principal === true) {
      log('✅ PASSOU: Primeiro currículo é principal', 'green');
    } else {
      log('❌ FALHOU: Primeiro currículo NÃO é principal', 'red');
    }

    // 4. TESTE 2: Criar segundo currículo marcando como principal
    log('\n📝 TESTE 2: Criar segundo currículo como principal', 'blue');
    log('Esperado: O primeiro deve ser desmarcado, o segundo deve ser principal');

    const curriculo2 = await criarCurriculo(token, {
      titulo: 'Meu Segundo Currículo',
      resumo: 'Desenvolvedor Backend',
      objetivo: 'Foco em APIs e microservices',
      principal: true,
    });

    if (curriculo2.principal === true) {
      log('✅ Segundo currículo criado como principal', 'green');
    } else {
      log('❌ FALHOU: Segundo currículo NÃO foi criado como principal', 'red');
    }

    // 5. Verificar lista de currículos
    log('\n📝 TESTE 3: Verificar lista de currículos', 'blue');
    log('Esperado: Exatamente 1 currículo principal');

    const curriculos = await listarCurriculos(token);
    const numPrincipais = await verificarPrincipais(curriculos);

    if (numPrincipais === 1) {
      log('✅ PASSOU: Exatamente 1 currículo principal', 'green');
    } else {
      log(`❌ FALHOU: ${numPrincipais} currículos principais (esperado: 1)`, 'red');
    }

    // 6. TESTE 4: Atualizar outro currículo para principal
    log('\n📝 TESTE 4: Atualizar primeiro currículo para principal', 'blue');
    log('Esperado: O segundo deve ser desmarcado, o primeiro deve ser principal');

    const curriculo1Atualizado = await atualizarCurriculo(token, curriculo1.id, {
      principal: true,
    });

    if (curriculo1Atualizado.principal === true) {
      log('✅ Primeiro currículo atualizado para principal', 'green');
    } else {
      log('❌ FALHOU: Primeiro currículo NÃO foi marcado como principal', 'red');
    }

    const curriculosAposUpdate = await listarCurriculos(token);
    const numPrincipaisAposUpdate = await verificarPrincipais(curriculosAposUpdate);

    if (numPrincipaisAposUpdate === 1) {
      log('✅ PASSOU: Ainda exatamente 1 currículo principal', 'green');
    } else {
      log(`❌ FALHOU: ${numPrincipaisAposUpdate} currículos principais (esperado: 1)`, 'red');
    }

    // 7. TESTE 5: Tentar desmarcar o único principal
    log('\n📝 TESTE 5: Tentar desmarcar único principal', 'blue');
    log('Esperado: Deve retornar erro CURRICULO_PRINCIPAL_REQUIRED');

    // Primeiro, criar mais um currículo e deixar apenas 1 principal
    await criarCurriculo(token, {
      titulo: 'Terceiro Currículo',
      resumo: 'Desenvolvedor Frontend',
      principal: false,
    });

    const curriculosAntes = await listarCurriculos(token);
    const curriculoPrincipal = curriculosAntes.find((c: any) => c.principal);
    const curriculoSecundario = curriculosAntes.find((c: any) => !c.principal);

    // Excluir o secundário para ter apenas 1 currículo principal
    if (curriculoSecundario) {
      await excluirCurriculo(token, curriculoSecundario.id);
    }

    try {
      await atualizarCurriculo(token, curriculoPrincipal.id, {
        principal: false,
      });
      log('❌ FALHOU: Deveria ter retornado erro mas não retornou', 'red');
    } catch (error: any) {
      if (error.response?.data?.code === 'CURRICULO_PRINCIPAL_REQUIRED') {
        log('✅ PASSOU: Erro CURRICULO_PRINCIPAL_REQUIRED retornado corretamente', 'green');
      } else {
        log(
          `❌ FALHOU: Erro diferente do esperado: ${error.response?.data?.code || error.message}`,
          'red',
        );
      }
    }

    // 8. TESTE 6: Excluir currículo principal (deve promover outro)
    log('\n📝 TESTE 6: Excluir currículo principal', 'blue');
    log('Esperado: Outro currículo deve ser promovido a principal');

    // Criar mais um currículo para ter pelo menos 2
    await criarCurriculo(token, {
      titulo: 'Quarto Currículo',
      resumo: 'Desenvolvedor Mobile',
      principal: false,
    });

    const curriculosAntesDelete = await listarCurriculos(token);
    const principalAntesDelete = curriculosAntesDelete.find((c: any) => c.principal);

    if (principalAntesDelete) {
      await excluirCurriculo(token, principalAntesDelete.id);
      log('✅ Currículo principal excluído', 'green');

      const curriculosDepoisDelete = await listarCurriculos(token);
      const numPrincipaisDepoisDelete = await verificarPrincipais(curriculosDepoisDelete);

      if (curriculosDepoisDelete.length > 0 && numPrincipaisDepoisDelete === 1) {
        log('✅ PASSOU: Outro currículo foi promovido a principal', 'green');
      } else {
        log(`❌ FALHOU: ${numPrincipaisDepoisDelete} currículos principais após exclusão`, 'red');
      }
    }

    // Resumo final
    console.log('\n' + '='.repeat(80));
    log('📊 RESUMO DOS TESTES', 'blue');
    console.log('='.repeat(80));

    const curriculosFinais = await listarCurriculos(token);
    log(`\nTotal de currículos finais: ${curriculosFinais.length}`);
    log(`Currículos principais: ${curriculosFinais.filter((c: any) => c.principal).length}`);

    console.log('\n' + '='.repeat(80));
    log('✅ TESTES CONCLUÍDOS', 'green');
    console.log('='.repeat(80) + '\n');
  } catch (error: any) {
    log('\n❌ ERRO NO TESTE:', 'red');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
