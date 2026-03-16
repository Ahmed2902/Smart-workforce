import prisma from '../prismaClient';
import bcrypt, { hash } from 'bcryptjs';
import AppError from '../utils/appError';
import * as jwtUtil from '../utils/jwt';
import crypto from 'crypto';
import { sendResetEmail } from '../utils/email';
import * as redis from '@swma/shared';

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

export const createUser = async (
  email: string,
  password: string,
  name: string,
  phone: string,
) => {
  const existingauthUser = await prisma.authUser.findUnique({
    where: { email },
  });
  if (existingauthUser) throw new AppError('authUser already exists', 400);

  const hashedPassword = await bcrypt.hash(password, 10);

  const normalizedEmail = email.trim().toLowerCase();
  const bootstrapEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const allowFirstAdmin = process.env.ALLOW_BOOTSTRAP_ADMIN === 'true';

  let role: 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'EMPLOYEE' = 'EMPLOYEE';
  if (bootstrapEmail && normalizedEmail === bootstrapEmail) {
    role = 'ADMIN';
  } else if (allowFirstAdmin) {
    const existingAdmin = await prisma.authUser.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (!existingAdmin) {
      role = 'ADMIN';
    }
  }

  const authUser = await prisma.authUser.create({
    data: { email, passwordHash: hashedPassword, role },
  });
  return authUser;
};

export const login = async (email: string, password: string) => {
  // Try to get user from cache first
  const cacheKey = `auth:user:email:${email.toLowerCase()}`;
  let authUser = await redis.getCache(cacheKey);

  // If not in cache, query database
  if (!authUser) {
    authUser = await prisma.authUser.findUnique({ where: { email } });
    if (authUser) {
      // Cache the user for 5 minutes
      await redis.setCache(cacheKey, authUser, 300);
    }
  }

  if (!authUser) throw new AppError('Invalid credentials', 401);

  const isPasswordValid = await bcrypt.compare(password, authUser.passwordHash);
  if (!isPasswordValid) throw new AppError('Invalid credentials', 401);
  const token = jwtUtil.sign({ sub: authUser.id, email: authUser.email });
  const refreshToken = await issueRefreshToken(authUser.id);

  return { authUser, token, refreshToken };
};

// Forgot Password
export const forgotPassword = async (email: string) => {
  const authUser = await prisma.authUser.findUnique({ where: { email } });

  if (!authUser) throw new AppError('No authUser found with that email', 404);

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); //1 hour

  await prisma.authUser.update({
    where: { email },
    data: {
      passwordResetToken: resetTokenHash,
      passwordResetExpiresAt: expires,
    },
  });

  const frontendBase =
    process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000';

  const resetUrl = `${frontendBase}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

  await sendResetEmail(email, resetUrl);
  return resetToken;
};

// Reset Password
export const resetPassword = async (token: string, newPassword: string) => {
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  const authUser = await prisma.authUser.findFirst({
    where: {
      passwordResetToken: resetTokenHash,
      passwordResetExpiresAt: { gt: new Date() },
    },
  });
  if (!authUser) throw new AppError('Token is invalid or has expired', 400);
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.authUser.update({
    where: { id: authUser.id },
    data: {
      passwordHash: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });
  await revokeAllRefreshTokensForauthUser(authUser.id.toString());
};

// Get authUsers with Pagination & Filtering
export const getUsers = async ({
  page = 1,
  limit = 10,
  search = '',
  fields = [],
  role,
  isActive,
}: {
  page?: number;
  limit?: number;
  search?: string;
  fields?: string[];
  role?: string;
  isActive?: boolean;
}) => {
  const skip = (page - 1) * limit;
  const where: any = {
    ...(search && {
      OR: [{ email: { contains: search } }, { name: { contains: search } }],
    }),
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
  };

  const selectFields: any = {};
  if (fields.length > 0) {
    fields.forEach((field) => {
      selectFields[field] = true;
    });
  }

  const authUsers = await prisma.authUser.findMany({
    where,
    skip,
    take: limit,
    select: fields.length > 0 ? selectFields : undefined,
  });

  const totalauthUsers = await prisma.authUser.count({ where });
  return { authUsers, total: totalauthUsers };
};

export const issueRefreshToken = async (
  authUserId: string,
  ip = 'system',
  userAgent: string = 'unknown',
) => {
  const raw = crypto.randomBytes(48).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');

  const expiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      token: hashed,
      userId: authUserId,
      expiresAt,
      userAgent,
      ip,
    },
  });
  return raw;
};

export const rotateRefreshToken = async (
  rawToken: string,
  ip = 'system',
  userAgent: string = 'unknown',
) => {
  if (!rawToken) throw new AppError('Missing refresh token', 401);

  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  const revokedCacheKey = `auth:revoked:${hashed}`;

  // Check if token is revoked in cache first
  const isRevokedInCache = await redis.getCache(revokedCacheKey);
  if (isRevokedInCache) {
    throw new AppError('invalid refresh token', 401);
  }

  const existing = await prisma.refreshToken.findUnique({
    where: { token: hashed },
  });

  if (!existing || existing?.revoked) {
    // Cache the revocation
    await redis.setCache(revokedCacheKey, true, 2592000); // 30 days
    throw new AppError('invalid refresh token', 401);
  }

  if (existing.expiresAt < new Date()) {
    // expired
    // optional: mark as revoked for hygiene
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true },
    });
    await redis.setCache(revokedCacheKey, true, 2592000); // 30 days
    throw new AppError('Refresh token expired', 401);
  }

  const newRaw = crypto.randomBytes(48).toString('hex');
  const newHash = crypto.createHash('sha256').update(newRaw).digest('hex');
  const newExpiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true },
    }),
    prisma.refreshToken.create({
      data: {
        token: newHash,
        userId: existing.userId,
        ip,
        userAgent,
        expiresAt: newExpiresAt,
      },
    }),
  ]);

  // Mark old token as revoked in cache
  await redis.setCache(revokedCacheKey, true, 2592000); // 30 days

  const authUser = await prisma.authUser.findUnique({
    where: { id: existing.userId },
  });
  if (!authUser) throw new AppError('authUser not found', 404);

  const accessToken = jwtUtil.sign({
    sub: authUser.id,
    email: authUser.email,
    role: authUser.role,
  });

  return { accessToken, newRefreshToken: newRaw };
};

export const revokeRefreshToken = async (rawToken: string, ip = 'system') => {
  if (!rawToken) return;

  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  await prisma.refreshToken.updateMany({
    where: { token: hashed, revoked: false },
    data: { revoked: true },
  });

  // Mark as revoked in Redis cache for fast subsequent checks
  const revokedCacheKey = `auth:revoked:${hashed}`;
  await redis.setCache(revokedCacheKey, true, 2592000); // 30 days
};

export const revokeAllRefreshTokensForauthUser = async (authUserId: string) => {
  await prisma.refreshToken.updateMany({
    where: { userId: authUserId, revoked: false },
    data: { revoked: true },
  });
};

export const getActiveSessions = async (userId: string) => {
  return await prisma.refreshToken.findMany({
    where: { userId, revoked: false, expiresAt: { gt: new Date() } },
    select: { id: true, ip: true, userAgent: true, createdAt: true },
  });
};

export const revokeSession = async (sessionId: string) => {
  await prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revoked: true },
  });
};

export const revokeAllSessionsExcept = async (
  userId: string,
  sessionId: string,
) => {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      id: { not: sessionId },
    },
    data: { revoked: true },
  });
};
