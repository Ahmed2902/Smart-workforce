import { Request } from 'express';
import AppError from './appError';

export type AuthenticatedUser = NonNullable<Request['user']>;

export function requireActor(actor?: AuthenticatedUser): AuthenticatedUser {
  if (!actor) {
    throw new AppError('Not authenticated', 401);
  }

  return actor;
}

export function isSuperadmin(actor: AuthenticatedUser) {
  return actor.systemRole === 'SUPERADMIN';
}

export function assertSameOrganization(
  actor: AuthenticatedUser,
  organizationId?: string | null,
  message = 'You can only access attendance for your organization',
) {
  if (isSuperadmin(actor)) {
    return;
  }

  if (
    !organizationId ||
    !actor.organizationId ||
    actor.organizationId !== organizationId
  ) {
    throw new AppError(message, 403);
  }
}

export function assertOrgWriteAccess(
  actor: AuthenticatedUser,
  organizationId?: string | null,
  message = 'Forbidden: insufficient permissions',
) {
  if (isSuperadmin(actor)) {
    return;
  }

  assertSameOrganization(
    actor,
    organizationId,
    'You can only manage attendance for your organization',
  );

  if (
    !actor.organizationRole ||
    !['ADMIN', 'MANAGER'].includes(actor.organizationRole)
  ) {
    throw new AppError(message, 403);
  }
}
