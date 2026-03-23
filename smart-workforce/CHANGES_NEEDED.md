# Platform Authorization Direction

This document replaces the earlier notes that recommended restoring `x-user-role`,
`BOOTSTRAP_ADMIN_EMAIL`, or authenticated-user org creation.

## Current decisions

- `auth-service` authenticates identity only.
- The gateway forwards only identity headers to downstream services:
  - `X-User-Id`
  - `X-User-Email`
  - `X-Auth-Sub`
  - `X-Gateway-Token`
- `auth-service.role` remains stored for compatibility and auth-service-local checks only.
- `user-service` is the source of truth for business authorization semantics.
- Organization creation remains `SUPERADMIN`-only.

## Downstream authorization model

- `schedule-service`, `attendance-service`, and `payroll-service` authorize from local cached user projections.
- Cached user projections are populated from `user-service` events, not from auth headers.
- The downstream request user contract is:
  - `userId`
  - `authUserId`
  - `email`
  - `systemRole`
  - `organizationId`
  - `organizationRole`
- `SUPERADMIN` bypass remains valid across the domain services.
- Organization-scoped admin mutations require `organizationRole` of `ADMIN` or `MANAGER` in the caller's effective organization.

## Event contract

- `user-service` publishes the normalized user projection used by downstream consumers:
  - `id`
  - `authUserId`
  - `email`
  - `systemRole`
  - `isActive`
  - `organizationId`
  - `organizationRole`
- Membership events remain the authority for effective org assignment and org-role changes.
- Downstream consumers must not infer business authorization from `auth-service.role`.

## Internal service calls

- Internal clients must not send fake `X-User-Role` headers.
- If an internal call acts on behalf of a user, it should forward that real cached-user identity.
- If an internal call is system-driven, it should use a dedicated internal-service authentication mechanism.
