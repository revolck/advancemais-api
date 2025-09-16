type Bindings = Record<string, unknown>;

type KnownLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

type LogFn = (...args: unknown[]) => void;

export type AppLogger = {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
  child(bindings: Bindings): AppLogger;
};

const levelRank: Record<KnownLevel, number> = {
  fatal: 10,
  error: 20,
  warn: 30,
  info: 40,
  debug: 50,
  trace: 60,
  silent: 70,
};

const normalizeLevel = (value: string | undefined): KnownLevel => {
  if (!value) {
    return 'info';
  }

  const normalized = value.toLowerCase() as KnownLevel;

  return normalized in levelRank ? normalized : 'info';
};

const resolvedLevel = normalizeLevel(
  process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
);

const shouldLog = (requested: KnownLevel) => levelRank[requested] <= levelRank[resolvedLevel];

const baseBindings: Bindings = {
  service: 'advancemais-api',
  environment: process.env.NODE_ENV,
};

const createConsoleLogger = (bindings: Bindings = {}): AppLogger => {
  const activeBindings = { ...baseBindings, ...bindings };

  const prefixArgs = (args: unknown[]) =>
    Object.keys(activeBindings).length ? [activeBindings, ...args] : args;

  return {
    info: (...args) => {
      if (shouldLog('info')) {
        console.info(...prefixArgs(args));
      }
    },
    warn: (...args) => {
      if (shouldLog('warn')) {
        console.warn(...prefixArgs(args));
      }
    },
    error: (...args) => {
      console.error(...prefixArgs(args));
    },
    debug: (...args) => {
      if (shouldLog('debug')) {
        console.debug(...prefixArgs(args));
      }
    },
    child: (childBindings: Bindings) =>
      createConsoleLogger({ ...activeBindings, ...childBindings }),
  };
};

let activeLogger: AppLogger = createConsoleLogger();

const proxyLogger: AppLogger = {
  info: (...args) => activeLogger.info(...args),
  warn: (...args) => activeLogger.warn(...args),
  error: (...args) => activeLogger.error(...args),
  debug: (...args) => activeLogger.debug(...args),
  child: (bindings) => activeLogger.child(bindings),
};

const tryLoadPino = async () => {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string,
  ) => Promise<unknown>;

  try {
    const module = await dynamicImport('pino');
    const factory =
      typeof module === 'function'
        ? module
        : typeof (module as { default?: unknown }).default === 'function'
          ? (module as { default: unknown }).default
          : undefined;

    if (typeof factory === 'function') {
      activeLogger = factory({
        level: resolvedLevel,
        base: baseBindings,
      }) as AppLogger;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn("⚠️ Módulo 'pino' não encontrado - usando logger baseado em console.");
      if (error instanceof Error && error.message) {
        console.warn(`ℹ️ Detalhes: ${error.message}`);
      }
    }
  }
};

void tryLoadPino();

export { proxyLogger as logger };
