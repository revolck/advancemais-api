import Module from 'node:module';
import path from 'node:path';

type ModuleWithResolve = typeof Module & {
  _resolveFilename(
    request: string,
    parent?: NodeModule | null,
    isMain?: boolean,
    options?: {
      paths?: string[];
    },
  ): string;
};

const globalFlag = '__advancemaisModuleAliasRegistered';

const globalContext = globalThis as Record<string, unknown>;

if (!globalContext[globalFlag]) {
  const moduleConstructor = Module as ModuleWithResolve;
  const originalResolveFilename = moduleConstructor._resolveFilename.bind(Module);
  const baseDir = path.resolve(__dirname, '..');
  const aliasPrefix = '@/';

  moduleConstructor._resolveFilename = function patchedResolveFilename(
    request,
    parent,
    isMain,
    options,
  ) {
    if (typeof request === 'string' && request.startsWith(aliasPrefix)) {
      const relativePath = request.slice(aliasPrefix.length);
      const absolutePath = path.resolve(baseDir, relativePath);
      return originalResolveFilename(absolutePath, parent ?? undefined, isMain, options);
    }

    return originalResolveFilename(request, parent ?? undefined, isMain, options);
  };

  globalContext[globalFlag] = true;
}
