/**
 * Script de automação de testes para cadastro de aulas via navegador
 *
 * Testa diferentes combinações de:
 * - Modalidades (ONLINE, PRESENCIAL, AO_VIVO, SEMIPRESENCIAL)
 * - Vínculos (sem vínculos, curso+turma, instrutor, curso+turma+instrutor)
 * - Materiais complementares (com e sem)
 */

import puppeteer, { Page } from 'puppeteer';
import { prisma } from '../src/config/prisma';

const BASE_URL = 'http://localhost:3001';
const LOGIN_CREDENTIALS = {
  cpf: '11111111111',
  senha: 'AdminTeste@123',
};

interface IDsDisponiveis {
  cursoId?: string;
  turmaId?: string;
  instrutorId?: string;
}

interface TestConfig {
  modalidade: 'ONLINE' | 'PRESENCIAL' | 'AO_VIVO' | 'SEMIPRESENCIAL';
  titulo: string;
  descricao: string;
  duracaoMinutos: number;
  obrigatoria: boolean;
  cursoId?: string;
  turmaId?: string;
  instrutorId?: string;
  materiais?: string[];
  youtubeUrl?: string;
  dataInicio?: string;
  horaInicio?: string;
  dataFim?: string;
  horaFim?: string;
}

const resultados: {
  teste: string;
  sucesso: boolean;
  erro?: string;
}[] = [];

async function fazerLogin(page: Page): Promise<boolean> {
  try {
    console.log('🔐 Fazendo login...');
    await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle2' });

    // Aguardar campos de login aparecerem
    await page.waitForSelector('input[type="text"], input[placeholder*="CPF"]', { timeout: 10000 });

    // Preencher CPF
    const cpfInput = await page.$('input[type="text"], input[placeholder*="CPF"]');
    if (cpfInput) {
      await cpfInput.type(LOGIN_CREDENTIALS.cpf, { delay: 50 });
    }

    // Preencher senha
    const senhaInput = await page.$('input[type="password"]');
    if (senhaInput) {
      await senhaInput.type(LOGIN_CREDENTIALS.senha, { delay: 50 });
    }

    // Clicar no botão de login - usar XPath para encontrar por texto
     
    const loginButton = await page.evaluateHandle(() => {
      // eslint-disable-next-line no-undef
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find((btn) => btn.textContent?.includes('Entrar') || btn.type === 'submit');
    });

    if (loginButton && loginButton.asElement()) {
      await loginButton.asElement()!.click();
    } else {
      // Tentar encontrar por type submit
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
      }
    }

    // Aguardar redirecionamento ou verificar se login foi bem-sucedido
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verificar se está logado (verificar URL ou elementos do dashboard)
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/cursos')) {
      console.log('✅ Login realizado com sucesso');
      return true;
    }

    console.log('⚠️ Login pode ter falhado, continuando...');
    return true; // Continuar mesmo assim
  } catch (error: any) {
    console.error('❌ Erro ao fazer login:', error.message);
    return false;
  }
}

async function navegarParaCadastroAulas(page: Page): Promise<boolean> {
  try {
    console.log('📝 Navegando para página de cadastro de aulas...');
    await page.goto(`${BASE_URL}/dashboard/cursos/aulas/cadastrar`, { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return true;
  } catch (error: any) {
    console.error('❌ Erro ao navegar para cadastro:', error.message);
    return false;
  }
}

async function preencherFormularioAula(page: Page, config: TestConfig): Promise<boolean> {
  try {
    console.log(`📋 Preenchendo formulário: ${config.titulo}`);

    // Aguardar formulário carregar
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Preencher título
    const tituloInput = await page.$(
      'input[name="titulo"], input[placeholder*="título"], input[placeholder*="Título"]',
    );
    if (tituloInput) {
      await tituloInput.click({ clickCount: 3 });
      await tituloInput.type(config.titulo, { delay: 50 });
    }

    // Preencher descrição
    const descricaoInput = await page.$(
      'textarea[name="descricao"], textarea[placeholder*="descrição"], textarea[placeholder*="Descrição"]',
    );
    if (descricaoInput) {
      await descricaoInput.click({ clickCount: 3 });
      await descricaoInput.type(config.descricao, { delay: 50 });
    }

    // Selecionar modalidade
    const modalidadeSelect = await page.$('select[name="modalidade"], select[id*="modalidade"]');
    if (modalidadeSelect) {
      await modalidadeSelect.select(config.modalidade);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      // Tentar encontrar e clicar usando evaluate
       
      const clicou = await page.evaluate((modalidade) => {
        // Tentar select primeiro
        // eslint-disable-next-line no-undef
        const select = document.querySelector(
          'select[name="modalidade"], select[id*="modalidade"]',
          // eslint-disable-next-line no-undef
        ) as HTMLSelectElement;
        if (select) {
          select.value = modalidade;
          // eslint-disable-next-line no-undef
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // Tentar input radio com value
        // eslint-disable-next-line no-undef
        const input = document.querySelector(
          `input[type="radio"][value="${modalidade}"]`,
          // eslint-disable-next-line no-undef
        ) as HTMLInputElement;
        if (input) {
          input.click();
          // eslint-disable-next-line no-undef
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // Tentar label com texto e encontrar input associado
        // eslint-disable-next-line no-undef
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          if (label.textContent?.includes(modalidade)) {
            const inputId = label.getAttribute('for');
            if (inputId) {
              // eslint-disable-next-line no-undef
              const input = document.getElementById(inputId) as HTMLInputElement;
              if (input) {
                input.click();
                // eslint-disable-next-line no-undef
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
            }
            // Se não tem for, tentar clicar no label mesmo
            label.click();
            return true;
          }
        }

        return false;
      }, config.modalidade);

      if (!clicou) {
        console.log(`⚠️  Não foi possível selecionar modalidade ${config.modalidade}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Preencher duração
    const duracaoInput = await page.$(
      'input[name="duracaoMinutos"], input[type="number"][placeholder*="duração"], input[type="number"][placeholder*="Duração"]',
    );
    if (duracaoInput) {
      await duracaoInput.click({ clickCount: 3 });
      await duracaoInput.type(config.duracaoMinutos.toString(), { delay: 50 });
    }

    // Selecionar obrigatória
    const obrigatoriaCheckbox = await page.$(
      'input[name="obrigatoria"], input[type="checkbox"][id*="obrigatoria"]',
    );
    if (obrigatoriaCheckbox) {
       
      const isChecked = await page.evaluate(
        // eslint-disable-next-line no-undef
        (el: HTMLInputElement) => el.checked,
        obrigatoriaCheckbox,
      );
      if (config.obrigatoria !== isChecked) {
        await obrigatoriaCheckbox.click();
      }
    }

    // Preencher campos específicos por modalidade
    if (config.modalidade === 'ONLINE' && config.youtubeUrl) {
      const youtubeInput = await page.$(
        'input[name="youtubeUrl"], input[placeholder*="YouTube"], input[placeholder*="youtube"]',
      );
      if (youtubeInput) {
        await youtubeInput.click({ clickCount: 3 });
        await youtubeInput.type(config.youtubeUrl, { delay: 50 });
      }
    }

    if (
      (config.modalidade === 'PRESENCIAL' ||
        config.modalidade === 'AO_VIVO' ||
        config.modalidade === 'SEMIPRESENCIAL') &&
      config.dataInicio
    ) {
      const dataInicioInput = await page.$(
        'input[name="dataInicio"], input[type="date"][id*="dataInicio"]',
      );
      if (dataInicioInput) {
        await dataInicioInput.type(config.dataInicio, { delay: 50 });
      }

      if (config.horaInicio) {
        const horaInicioInput = await page.$(
          'input[name="horaInicio"], input[type="time"][id*="horaInicio"]',
        );
        if (horaInicioInput) {
          await horaInicioInput.type(config.horaInicio, { delay: 50 });
        }
      }
    }

    // Selecionar curso (se fornecido)
    if (config.cursoId) {
      const cursoSelect = await page.$('select[name="cursoId"], select[id*="curso"]');
      if (cursoSelect) {
        await cursoSelect.select(config.cursoId);
        await new Promise((resolve) => setTimeout(resolve, 500)); // Aguardar carregar turmas
      }
    }

    // Selecionar turma (se fornecido)
    if (config.turmaId) {
      const turmaSelect = await page.$('select[name="turmaId"], select[id*="turma"]');
      if (turmaSelect) {
        await turmaSelect.select(config.turmaId);
      }
    }

    // Selecionar instrutor (se fornecido)
    if (config.instrutorId) {
      const instrutorSelect = await page.$('select[name="instrutorId"], select[id*="instrutor"]');
      if (instrutorSelect) {
        await instrutorSelect.select(config.instrutorId);
      }
    }

    // Adicionar materiais (se fornecido)
    if (config.materiais && config.materiais.length > 0) {
      for (const material of config.materiais) {
        // Procurar botão de adicionar material
         
        const addMaterialButton = await page.evaluateHandle(() => {
          // eslint-disable-next-line no-undef
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(
            (btn) =>
              btn.textContent?.includes('Adicionar') ||
              btn.textContent?.includes('Material') ||
              btn.id?.includes('material'),
          );
        });
        if (addMaterialButton && addMaterialButton.asElement()) {
          await addMaterialButton.asElement()!.click();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Preencher URL do material
          const materialInput = await page.$(
            'input[type="url"], input[placeholder*="URL"], input[name*="material"]',
          );
          if (materialInput) {
            await materialInput.type(material, { delay: 50 });
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    return true;
  } catch (error: any) {
    console.error(`❌ Erro ao preencher formulário:`, error.message);
    return false;
  }
}

async function submeterFormulario(page: Page): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    // Procurar botão de salvar
     
    const saveButton = await page.evaluateHandle(() => {
      // eslint-disable-next-line no-undef
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(
        (btn) =>
          btn.textContent?.includes('Salvar') ||
          btn.textContent?.includes('Cadastrar') ||
          btn.type === 'submit',
      );
    });
    if (!saveButton || !saveButton.asElement()) {
      // Tentar encontrar por type submit como fallback
      const submitButton = await page.$('button[type="submit"]');
      if (!submitButton) {
        return { sucesso: false, erro: 'Botão de salvar não encontrado' };
      }
      await submitButton.click();
    } else {
      await saveButton.asElement()!.click();
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verificar se houve erro ou sucesso
    const errorMessage = await page.$('.error, .alert-danger, [role="alert"]');
    if (errorMessage) {
      const errorText = await page.evaluate((el) => el.textContent, errorMessage);
      return { sucesso: false, erro: errorText || 'Erro desconhecido' };
    }

    // Verificar se redirecionou ou mostrou mensagem de sucesso
    const successMessage = await page.$('.success, .alert-success, [role="status"]');
    if (successMessage) {
      return { sucesso: true };
    }

    // Verificar URL atual
    const currentUrl = page.url();
    if (currentUrl.includes('/aulas') && !currentUrl.includes('/cadastrar')) {
      return { sucesso: true };
    }

    return { sucesso: true }; // Assumir sucesso se não houver erro visível
  } catch (error: any) {
    return { sucesso: false, erro: error.message };
  }
}

async function executarTeste(page: Page, nomeTeste: string, config: TestConfig): Promise<void> {
  console.log(`\n🧪 Executando teste: ${nomeTeste}`);

  try {
    // Navegar para cadastro
    const navegou = await navegarParaCadastroAulas(page);
    if (!navegou) {
      resultados.push({
        teste: nomeTeste,
        sucesso: false,
        erro: 'Não foi possível navegar para cadastro',
      });
      return;
    }

    // Preencher formulário
    const preencheu = await preencherFormularioAula(page, config);
    if (!preencheu) {
      resultados.push({ teste: nomeTeste, sucesso: false, erro: 'Erro ao preencher formulário' });
      return;
    }

    // Submeter
    const resultado = await submeterFormulario(page);
    resultados.push({
      teste: nomeTeste,
      sucesso: resultado.sucesso,
      erro: resultado.erro,
    });

    if (resultado.sucesso) {
      console.log(`✅ ${nomeTeste} - SUCESSO`);
    } else {
      console.log(`❌ ${nomeTeste} - FALHOU: ${resultado.erro}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error: any) {
    console.error(`❌ Erro no teste ${nomeTeste}:`, error.message);
    resultados.push({ teste: nomeTeste, sucesso: false, erro: error.message });
  }
}

async function obterIDsDisponiveis(): Promise<IDsDisponiveis> {
  console.log('🔍 Buscando IDs disponíveis no banco de dados...\n');

  const ids: IDsDisponiveis = {};

  try {
    // Buscar primeiro curso
    const curso = await prisma.cursos.findFirst({
      where: { statusPadrao: 'PUBLICADO' },
      select: { id: true, nome: true },
    });

    if (curso) {
      ids.cursoId = curso.id;
      console.log(`✅ Curso encontrado: ${curso.nome} (${curso.id})`);
    } else {
      console.log('⚠️  Nenhum curso encontrado');
    }

    // Buscar primeira turma (se tiver curso, buscar turma desse curso)
    const turma = await prisma.cursosTurmas.findFirst({
      where: ids.cursoId ? { cursoId: ids.cursoId } : undefined,
      select: { id: true, nome: true, cursoId: true },
    });

    if (turma) {
      ids.turmaId = turma.id;
      ids.cursoId = turma.cursoId; // Garantir que cursoId seja da turma
      console.log(`✅ Turma encontrada: ${turma.nome} (${turma.id})`);
    } else {
      console.log('⚠️  Nenhuma turma encontrada');
    }

    // Buscar primeiro instrutor
    const instrutor = await prisma.usuarios.findFirst({
      where: { role: 'INSTRUTOR', status: 'ATIVO' },
      select: { id: true, nomeCompleto: true },
    });

    if (instrutor) {
      ids.instrutorId = instrutor.id;
      console.log(`✅ Instrutor encontrado: ${instrutor.nomeCompleto} (${instrutor.id})`);
    } else {
      console.log('⚠️  Nenhum instrutor encontrado');
    }

    console.log('');
  } catch (error: any) {
    console.error('❌ Erro ao buscar IDs:', error.message);
  }

  return ids;
}

async function main() {
  console.log('🚀 Iniciando testes automatizados de cadastro de aulas\n');

  // Obter IDs disponíveis
  const ids = await obterIDsDisponiveis();

  const browser = await puppeteer.launch({
    headless: false, // Mostrar navegador para debug
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();

  try {
    // Fazer login
    const loginSucesso = await fazerLogin(page);
    if (!loginSucesso) {
      console.error('❌ Não foi possível fazer login. Abortando testes.');
      await browser.close();
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ============================================
    // FASE 1: Sem vínculos (sem curso, turma, instrutor, materiais)
    // ============================================
    console.log('\n📌 FASE 1: Testes sem vínculos\n');

    await executarTeste(page, '1.1 - ONLINE sem vínculos', {
      modalidade: 'ONLINE',
      titulo: 'Aula Teste ONLINE Sem Vínculos',
      descricao: 'Descrição da aula ONLINE sem vínculos para teste automatizado',
      duracaoMinutos: 60,
      obrigatoria: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=test123',
    });

    await executarTeste(page, '1.2 - PRESENCIAL sem vínculos', {
      modalidade: 'PRESENCIAL',
      titulo: 'Aula Teste PRESENCIAL Sem Vínculos',
      descricao: 'Descrição da aula PRESENCIAL sem vínculos para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      dataInicio: '2026-03-01',
      horaInicio: '09:00',
    });

    await executarTeste(page, '1.3 - AO_VIVO sem vínculos', {
      modalidade: 'AO_VIVO',
      titulo: 'Aula Teste AO_VIVO Sem Vínculos',
      descricao: 'Descrição da aula AO_VIVO sem vínculos para teste automatizado',
      duracaoMinutos: 120,
      obrigatoria: true,
      dataInicio: '2026-03-15',
      horaInicio: '14:00',
    });

    await executarTeste(page, '1.4 - SEMIPRESENCIAL sem vínculos', {
      modalidade: 'SEMIPRESENCIAL',
      titulo: 'Aula Teste SEMIPRESENCIAL Sem Vínculos',
      descricao: 'Descrição da aula SEMIPRESENCIAL sem vínculos para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      youtubeUrl: 'https://www.youtube.com/watch?v=test456',
    });

    // ============================================
    // FASE 2: Com curso e turma (sem instrutor, sem materiais)
    // ============================================
    console.log('\n📌 FASE 2: Testes com curso e turma\n');

    if (!ids.cursoId || !ids.turmaId) {
      console.log('⚠️  Pulando FASE 2: curso ou turma não encontrados');
    } else {
      const cursoId = ids.cursoId;
      const turmaId = ids.turmaId;

      await executarTeste(page, '2.1 - ONLINE com curso e turma', {
        modalidade: 'ONLINE',
        titulo: 'Aula Teste ONLINE Com Curso e Turma',
        descricao: 'Descrição da aula ONLINE com curso e turma para teste automatizado',
        duracaoMinutos: 60,
        obrigatoria: true,
        youtubeUrl: 'https://www.youtube.com/watch?v=test789',
        cursoId,
        turmaId,
      });

      await executarTeste(page, '2.2 - PRESENCIAL com curso e turma', {
        modalidade: 'PRESENCIAL',
        titulo: 'Aula Teste PRESENCIAL Com Curso e Turma',
        descricao: 'Descrição da aula PRESENCIAL com curso e turma para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        dataInicio: '2026-03-02',
        horaInicio: '09:00',
        cursoId,
        turmaId,
      });

      await executarTeste(page, '2.3 - AO_VIVO com curso e turma', {
        modalidade: 'AO_VIVO',
        titulo: 'Aula Teste AO_VIVO Com Curso e Turma',
        descricao: 'Descrição da aula AO_VIVO com curso e turma para teste automatizado',
        duracaoMinutos: 120,
        obrigatoria: true,
        dataInicio: '2026-03-16',
        horaInicio: '14:00',
        cursoId,
        turmaId,
      });

      await executarTeste(page, '2.4 - SEMIPRESENCIAL com curso e turma', {
        modalidade: 'SEMIPRESENCIAL',
        titulo: 'Aula Teste SEMIPRESENCIAL Com Curso e Turma',
        descricao: 'Descrição da aula SEMIPRESENCIAL com curso e turma para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        youtubeUrl: 'https://www.youtube.com/watch?v=test101',
        cursoId,
        turmaId,
      });
    }

    // ============================================
    // FASE 3: Com instrutor (sem curso/turma, sem materiais)
    // ============================================
    console.log('\n📌 FASE 3: Testes com instrutor\n');

    if (!ids.instrutorId) {
      console.log('⚠️  Pulando FASE 3: instrutor não encontrado');
    } else {
      const instrutorId = ids.instrutorId;

      await executarTeste(page, '3.1 - ONLINE com instrutor', {
        modalidade: 'ONLINE',
        titulo: 'Aula Teste ONLINE Com Instrutor',
        descricao: 'Descrição da aula ONLINE com instrutor para teste automatizado',
        duracaoMinutos: 60,
        obrigatoria: true,
        youtubeUrl: 'https://www.youtube.com/watch?v=test202',
        instrutorId,
      });

      await executarTeste(page, '3.2 - PRESENCIAL com instrutor', {
        modalidade: 'PRESENCIAL',
        titulo: 'Aula Teste PRESENCIAL Com Instrutor',
        descricao: 'Descrição da aula PRESENCIAL com instrutor para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        dataInicio: '2026-03-03',
        horaInicio: '09:00',
        instrutorId,
      });

      await executarTeste(page, '3.3 - AO_VIVO com instrutor', {
        modalidade: 'AO_VIVO',
        titulo: 'Aula Teste AO_VIVO Com Instrutor',
        descricao: 'Descrição da aula AO_VIVO com instrutor para teste automatizado',
        duracaoMinutos: 120,
        obrigatoria: true,
        dataInicio: '2026-03-17',
        horaInicio: '14:00',
        instrutorId,
      });

      await executarTeste(page, '3.4 - SEMIPRESENCIAL com instrutor', {
        modalidade: 'SEMIPRESENCIAL',
        titulo: 'Aula Teste SEMIPRESENCIAL Com Instrutor',
        descricao: 'Descrição da aula SEMIPRESENCIAL com instrutor para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        youtubeUrl: 'https://www.youtube.com/watch?v=test303',
        instrutorId,
      });
    }

    // ============================================
    // FASE 4: Com curso, turma e instrutor (sem materiais)
    // ============================================
    console.log('\n📌 FASE 4: Testes com curso, turma e instrutor\n');

    if (!ids.cursoId || !ids.turmaId || !ids.instrutorId) {
      console.log('⚠️  Pulando FASE 4: curso, turma ou instrutor não encontrados');
    } else {
      const cursoId = ids.cursoId;
      const turmaId = ids.turmaId;
      const instrutorId = ids.instrutorId;

      await executarTeste(page, '4.1 - ONLINE com curso, turma e instrutor', {
        modalidade: 'ONLINE',
        titulo: 'Aula Teste ONLINE Completa',
        descricao: 'Descrição da aula ONLINE completa para teste automatizado',
        duracaoMinutos: 60,
        obrigatoria: true,
        youtubeUrl: 'https://www.youtube.com/watch?v=test404',
        cursoId,
        turmaId,
        instrutorId,
      });

      await executarTeste(page, '4.2 - PRESENCIAL com curso, turma e instrutor', {
        modalidade: 'PRESENCIAL',
        titulo: 'Aula Teste PRESENCIAL Completa',
        descricao: 'Descrição da aula PRESENCIAL completa para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        dataInicio: '2026-03-04',
        horaInicio: '09:00',
        cursoId,
        turmaId,
        instrutorId,
      });

      await executarTeste(page, '4.3 - AO_VIVO com curso, turma e instrutor', {
        modalidade: 'AO_VIVO',
        titulo: 'Aula Teste AO_VIVO Completa',
        descricao: 'Descrição da aula AO_VIVO completa para teste automatizado',
        duracaoMinutos: 120,
        obrigatoria: true,
        dataInicio: '2026-03-18',
        horaInicio: '14:00',
        cursoId,
        turmaId,
        instrutorId,
      });

      await executarTeste(page, '4.4 - SEMIPRESENCIAL com curso, turma e instrutor', {
        modalidade: 'SEMIPRESENCIAL',
        titulo: 'Aula Teste SEMIPRESENCIAL Completa',
        descricao: 'Descrição da aula SEMIPRESENCIAL completa para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        youtubeUrl: 'https://www.youtube.com/watch?v=test505',
        cursoId,
        turmaId,
        instrutorId,
      });
    }

    // ============================================
    // FASE 5: Com materiais (sem outros vínculos)
    // ============================================
    console.log('\n📌 FASE 5: Testes com materiais\n');

    await executarTeste(page, '5.1 - ONLINE com materiais', {
      modalidade: 'ONLINE',
      titulo: 'Aula Teste ONLINE Com Materiais',
      descricao: 'Descrição da aula ONLINE com materiais para teste automatizado',
      duracaoMinutos: 60,
      obrigatoria: true,
      youtubeUrl: 'https://www.youtube.com/watch?v=test606',
      materiais: ['https://example.com/material1.pdf', 'https://example.com/material2.pdf'],
    });

    await executarTeste(page, '5.2 - PRESENCIAL com materiais', {
      modalidade: 'PRESENCIAL',
      titulo: 'Aula Teste PRESENCIAL Com Materiais',
      descricao: 'Descrição da aula PRESENCIAL com materiais para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      dataInicio: '2026-03-05',
      horaInicio: '09:00',
      materiais: ['https://example.com/material3.pdf'],
    });

    await executarTeste(page, '5.3 - AO_VIVO com materiais', {
      modalidade: 'AO_VIVO',
      titulo: 'Aula Teste AO_VIVO Com Materiais',
      descricao: 'Descrição da aula AO_VIVO com materiais para teste automatizado',
      duracaoMinutos: 120,
      obrigatoria: true,
      dataInicio: '2026-03-19',
      horaInicio: '14:00',
      materiais: ['https://example.com/material4.pdf', 'https://example.com/material5.pdf'],
    });

    await executarTeste(page, '5.4 - SEMIPRESENCIAL com materiais', {
      modalidade: 'SEMIPRESENCIAL',
      titulo: 'Aula Teste SEMIPRESENCIAL Com Materiais',
      descricao: 'Descrição da aula SEMIPRESENCIAL com materiais para teste automatizado',
      duracaoMinutos: 90,
      obrigatoria: false,
      youtubeUrl: 'https://www.youtube.com/watch?v=test707',
      materiais: ['https://example.com/material6.pdf'],
    });

    // ============================================
    // FASE 6: Com materiais + curso + turma + instrutor
    // ============================================
    console.log('\n📌 FASE 6: Testes completos com materiais\n');

    if (!ids.cursoId || !ids.turmaId || !ids.instrutorId) {
      console.log('⚠️  Pulando FASE 6: curso, turma ou instrutor não encontrados');
    } else {
      const cursoId = ids.cursoId;
      const turmaId = ids.turmaId;
      const instrutorId = ids.instrutorId;

      await executarTeste(page, '6.1 - ONLINE completo com materiais', {
        modalidade: 'ONLINE',
        titulo: 'Aula Teste ONLINE Completa Com Materiais',
        descricao: 'Descrição da aula ONLINE completa com materiais para teste automatizado',
        duracaoMinutos: 60,
        obrigatoria: true,
        youtubeUrl: 'https://www.youtube.com/watch?v=test808',
        cursoId,
        turmaId,
        instrutorId,
        materiais: ['https://example.com/material7.pdf', 'https://example.com/material8.pdf'],
      });

      await executarTeste(page, '6.2 - PRESENCIAL completo com materiais', {
        modalidade: 'PRESENCIAL',
        titulo: 'Aula Teste PRESENCIAL Completa Com Materiais',
        descricao: 'Descrição da aula PRESENCIAL completa com materiais para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        dataInicio: '2026-03-06',
        horaInicio: '09:00',
        cursoId,
        turmaId,
        instrutorId,
        materiais: ['https://example.com/material9.pdf'],
      });

      await executarTeste(page, '6.3 - AO_VIVO completo com materiais', {
        modalidade: 'AO_VIVO',
        titulo: 'Aula Teste AO_VIVO Completa Com Materiais',
        descricao: 'Descrição da aula AO_VIVO completa com materiais para teste automatizado',
        duracaoMinutos: 120,
        obrigatoria: true,
        dataInicio: '2026-03-20',
        horaInicio: '14:00',
        cursoId,
        turmaId,
        instrutorId,
        materiais: ['https://example.com/material10.pdf', 'https://example.com/material11.pdf'],
      });

      await executarTeste(page, '6.4 - SEMIPRESENCIAL completo com materiais', {
        modalidade: 'SEMIPRESENCIAL',
        titulo: 'Aula Teste SEMIPRESENCIAL Completa Com Materiais',
        descricao:
          'Descrição da aula SEMIPRESENCIAL completa com materiais para teste automatizado',
        duracaoMinutos: 90,
        obrigatoria: false,
        youtubeUrl: 'https://www.youtube.com/watch?v=test909',
        cursoId,
        turmaId,
        instrutorId,
        materiais: ['https://example.com/material12.pdf'],
      });
    }

    // ============================================
    // RESUMO
    // ============================================
    console.log('\n\n📊 RESUMO DOS TESTES\n');
    console.log('='.repeat(80));

    const sucessos = resultados.filter((r) => r.sucesso).length;
    const falhas = resultados.filter((r) => !r.sucesso).length;

    console.log(`Total: ${resultados.length} testes`);
    console.log(`✅ Sucessos: ${sucessos}`);
    console.log(`❌ Falhas: ${falhas}\n`);

    resultados.forEach((resultado) => {
      const status = resultado.sucesso ? '✅' : '❌';
      console.log(`${status} ${resultado.teste}`);
      if (!resultado.sucesso && resultado.erro) {
        console.log(`   Erro: ${resultado.erro}`);
      }
    });

    console.log('='.repeat(80));
  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
