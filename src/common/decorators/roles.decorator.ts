import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * 🛡️ Decorator para definir roles necessárias
 * @param roles - Array de roles que podem acessar o endpoint
 *
 * @example
 * ```typescript
 * @Roles(Role.ADMIN, Role.ADMINISTRATOR)
 * @Get('admin-only')
 * async adminEndpoint() { }
 * ```
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * 👮 Decorator para endpoints que requerem role de administrador
 */
export const AdminOnly = () => Roles(Role.ADMIN, Role.ADMINISTRATOR);

/**
 * 💼 Decorator para endpoints que requerem roles de gestão
 */
export const ManagerOnly = () =>
  Roles(Role.ADMIN, Role.ADMINISTRATOR, Role.HR, Role.PEDAGOGICAL);

/**
 * 🎓 Decorator para endpoints de professores e gestão acadêmica
 */
export const AcademicOnly = () =>
  Roles(Role.ADMIN, Role.ADMINISTRATOR, Role.PROFESSOR, Role.PEDAGOGICAL);

/**
 * 💰 Decorator para endpoints financeiros
 */
export const FinancialOnly = () =>
  Roles(Role.ADMIN, Role.ADMINISTRATOR, Role.FINANCIAL);

/**
 * 🏢 Decorator para endpoints de empresas e recrutadores
 */
export const BusinessOnly = () =>
  Roles(Role.ADMIN, Role.ADMINISTRATOR, Role.COMPANY, Role.RECRUITER, Role.HR);
