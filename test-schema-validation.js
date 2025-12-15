/**
 * Teste rápido de validação do schema de aulas
 * Valida diferentes formatos de data que o frontend pode enviar
 */

import { createAulaSchema } from './src/modules/cursos/aulas/validators/aulas.schema.ts';

const testCases = [
  {
    name: 'Formato YYYY-MM-DD (correto)',
    data: {
      titulo: 'Teste',
      descricao: 'Descrição teste',
      modalidade: 'PRESENCIAL',
      duracaoMinutos: 120,
      dataInicio: '2025-12-18',
      horaInicio: '18:00',
    },
  },
  {
    name: 'Formato ISO completo',
    data: {
      titulo: 'Teste',
      descricao: 'Descrição teste',
      modalidade: 'PRESENCIAL',
      duracaoMinutos: 120,
      dataInicio: '2025-12-18T00:00:00.000Z',
      horaInicio: '18:00',
    },
  },
  {
    name: 'Formato ISO sem timezone',
    data: {
      titulo: 'Teste',
      descricao: 'Descrição teste',
      modalidade: 'PRESENCIAL',
      duracaoMinutos: 120,
      dataInicio: '2025-12-18T18:00:00',
      horaInicio: '18:00',
    },
  },
  {
    name: 'Com dataFim no formato YYYY-MM-DD',
    data: {
      titulo: 'Teste',
      descricao: 'Descrição teste',
      modalidade: 'PRESENCIAL',
      duracaoMinutos: 120,
      dataInicio: '2025-12-18',
      dataFim: '2025-12-20',
      horaInicio: '18:00',
      horaFim: '20:00',
    },
  },
  {
    name: 'Com dataFim no formato ISO',
    data: {
      titulo: 'Teste',
      descricao: 'Descrição teste',
      modalidade: 'PRESENCIAL',
      duracaoMinutos: 120,
      dataInicio: '2025-12-18T00:00:00.000Z',
      dataFim: '2025-12-20T00:00:00.000Z',
      horaInicio: '18:00',
      horaFim: '20:00',
    },
  },
];

console.log('🧪 Testando validação do schema de aulas...\n');

testCases.forEach((testCase, index) => {
  console.log(`Teste ${index + 1}: ${testCase.name}`);
  try {
    const result = createAulaSchema.parse(testCase.data);
    console.log('  ✅ Válido');
    console.log(`     dataInicio: ${result.dataInicio}`);
    if (result.dataFim) {
      console.log(`     dataFim: ${result.dataFim}`);
    }
  } catch (error) {
    console.log('  ❌ Inválido');
    if (error.errors) {
      error.errors.forEach((err) => {
        console.log(`     - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.log(`     - ${error.message}`);
    }
  }
  console.log('');
});

