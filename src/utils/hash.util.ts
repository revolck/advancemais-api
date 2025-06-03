import * as argon2 from 'argon2';

export class HashUtil {
  private static readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  };

  /**
   * Gera hash da senha usando Argon2id
   */
  static async gerarHash(senha: string): Promise<string> {
    try {
      return await argon2.hash(senha, this.options);
    } catch (error) {
      throw new Error(`Erro ao gerar hash: ${error.message}`);
    }
  }

  /**
   * Verifica se a senha corresponde ao hash
   */
  static async verificarHash(hash: string, senha: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, senha);
    } catch (error) {
      throw new Error(`Erro ao verificar hash: ${error.message}`);
    }
  }
}
