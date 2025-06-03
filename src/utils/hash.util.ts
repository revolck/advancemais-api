import * as argon2 from 'argon2';

export class HashUtil {
  private static readonly options: argon2.Options = {
    type: argon2.argon2id, // Mais resistente a ataques side-channel
    memoryCost: 65536, // 64 MB de memória
    timeCost: 3, // 3 iterações
    parallelism: 4, // 4 threads paralelas
  };

  /**
   * 🔐 Gera hash seguro da senha usando Argon2id
   * @param senha - Senha em texto plano
   * @returns Hash da senha
   */
  static async gerarHash(senha: string): Promise<string> {
    try {
      return await argon2.hash(senha, this.options);
    } catch (error) {
      throw new Error(`Erro ao gerar hash da senha: ${error.message}`);
    }
  }

  /**
   * ✅ Verifica se a senha corresponde ao hash
   * @param hash - Hash armazenado
   * @param senha - Senha a verificar
   * @returns true se a senha estiver correta
   */
  static async verificarHash(hash: string, senha: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, senha);
    } catch (error) {
      throw new Error(`Erro ao verificar hash da senha: ${error.message}`);
    }
  }
}
