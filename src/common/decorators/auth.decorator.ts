import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 🌐 Marca endpoint como público (sem autenticação)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * 👤 Extrai usuário autenticado do request
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
