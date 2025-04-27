import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";

/**
 * Função de inicialização da aplicação
 */
async function bootstrap() {
  // Criar a aplicação NestJS
  const app = await NestFactory.create(AppModule);

  // Configurar porta da aplicação (usando variável de ambiente ou fallback para 3000)
  const port = process.env.PORT || 3000;

  // Iniciar o servidor
  await app.listen(port);

  // Log informativo
  Logger.log(`Aplicação rodando na porta ${port}`, "Bootstrap");
}

// Executar a função de bootstrap
bootstrap();
