import type { Application } from "express";
import swaggerJsdoc, { Options } from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AdvanceMais API",
      version: "1.0.0",
      description: "Documentação da API AdvanceMais",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Servidor de desenvolvimento",
      },
    ],
  },
  apis: ["./src/routes/**/*.ts", "./src/modules/**/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
