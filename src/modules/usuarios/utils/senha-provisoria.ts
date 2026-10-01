import { randomInt } from 'crypto';

// Sem caracteres ambíguos (0/O, 1/l/I) para facilitar a digitação
const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const NUMEROS = '23456789';
const SIMBOLOS = '@#$%*!?';
const TODOS = MAIUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;

const pick = (alphabet: string) => alphabet[randomInt(alphabet.length)];

/**
 * Gera uma senha provisória individual e criptograficamente aleatória.
 * Sempre contém maiúscula, minúscula, número e símbolo.
 */
export function gerarSenhaProvisoria(tamanho = 12): string {
  if (tamanho < 8) {
    throw new Error('A senha provisória deve ter pelo menos 8 caracteres');
  }

  const caracteres = [pick(MAIUSCULAS), pick(MINUSCULAS), pick(NUMEROS), pick(SIMBOLOS)];
  while (caracteres.length < tamanho) {
    caracteres.push(pick(TODOS));
  }

  // Embaralhamento Fisher-Yates para não fixar a posição de cada tipo
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }

  return caracteres.join('');
}
