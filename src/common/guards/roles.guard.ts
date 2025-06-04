import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../types/request.interface';

/**
 * 🛡️ Guard para verificação de roles
 * Verifica se o usuário possui uma das roles necessárias
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * 🔍 Verifica se o usuário tem permissão de acesso
   */
  canActivate(context: ExecutionContext): boolean {
    // 📋 Obter roles necessárias do decorator
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // ✅ Se não há roles específicas, permitir acesso
    if (!requiredRoles) {
      return true;
    }

    // 👤 Obter usuário da requisição
    const { user }: { user: AuthenticatedUser } = context
      .switchToHttp()
      .getRequest();

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // 🔍 Verificar se o usuário possui uma das roles necessárias
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado. Roles necessárias: ${requiredRoles.join(', ')}. Sua role: ${user.role}`,
      );
    }

    return true;
  }
}
