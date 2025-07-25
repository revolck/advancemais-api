import { Router } from "express";

/**
 * Utilitário avançado para debugar rotas e identificar problemas
 */
export const debugRouter = (router: Router, routerName: string) => {
  console.log(`🔍 Debugando rotas de: ${routerName}`);

  try {
    const routes = (router as any).stack;

    routes.forEach((layer: any, index: number) => {
      try {
        if (layer.route) {
          const route = layer.route;
          const methods = Object.keys(route.methods).join(", ").toUpperCase();
          const path = route.path;

          // Verifica se o path tem problemas
          if (!path || path.includes("undefined") || path.includes("null")) {
            console.error(
              `  ❌ ${
                index + 1
              }. PROBLEMA: ${methods} "${path}" - Path inválido`
            );
          } else {
            console.log(`  ✅ ${index + 1}. ${methods} ${path}`);
          }
        } else if (layer.regexp) {
          // Middleware sem rota específica
          console.log(`  🔧 ${index + 1}. Middleware: ${layer.regexp.source}`);
        }
      } catch (error) {
        // Type guard para verificar se error é uma instância de Error
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`  ❌ ${index + 1}. Erro na camada:`, errorMessage);
      }
    });
  } catch (error) {
    // Type guard para verificar se error é uma instância de Error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Erro ao debugar router ${routerName}:`, errorMessage);
  }
};

/**
 * Debug completo da aplicação Express
 */
export const debugExpressApp = (app: any) => {
  console.log("🔍 Debugando aplicação Express completa...");

  try {
    const routes = app._router?.stack || [];

    routes.forEach((layer: any, index: number) => {
      try {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods)
            .join(", ")
            .toUpperCase();
          const path = layer.route.path;
          console.log(`  📍 ${index + 1}. ${methods} ${path}`);
        } else if (layer.regexp && layer.handle) {
          const regexpSource = layer.regexp.source;
          console.log(`  🔧 ${index + 1}. Middleware/Router: ${regexpSource}`);

          // Se for um router, tenta debugar suas rotas
          if (layer.handle.stack) {
            console.log(`    └─ Sub-rotas encontradas:`);
            layer.handle.stack.forEach((subLayer: any, subIndex: number) => {
              if (subLayer.route) {
                const subMethods = Object.keys(subLayer.route.methods)
                  .join(", ")
                  .toUpperCase();
                const subPath = subLayer.route.path;
                console.log(`       ${subIndex + 1}. ${subMethods} ${subPath}`);
              }
            });
          }
        }
      } catch (error) {
        // Type guard para verificar se error é uma instância de Error
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`  ❌ ${index + 1}. Erro na camada:`, errorMessage);
      }
    });
  } catch (error) {
    // Type guard para verificar se error é uma instância de Error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Erro ao debugar aplicação:", errorMessage);
  }
};
