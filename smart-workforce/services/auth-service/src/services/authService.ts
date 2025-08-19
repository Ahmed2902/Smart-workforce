import prisma from '../prismaClient';
import bcrypt, { hash } from 'bcryptjs';
import AppError from '../utils/appError';
import * as jwtUtil from '../utils/jwt';
import crypto from 'crypto';

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

export const createUser = async (
  email: string,
  password: string,
  name: string,
  phone: string,
) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new AppError('user already exists', 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash: hashedPassword, name, phone },
  });
  return user;
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('Invalid credentials', 401);

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) throw new AppError('Invalid credentials', 401);
  const token = jwtUtil.sign({ sub: user.id, email: user.email });
  return { user, token };
};

// Forgot Password
export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('No user found with that email', 404);
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  await prisma.user.update({
    where: { email },
    data: {
      passwordResetToken: resetTokenHash,
      passwordResetExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });
  // Send email (dummy implementation)
  // Use nodemailer or similar in production
  // await sendResetEmail(user.email, resetToken);
  return resetToken;
};

// Reset Password
export const resetPassword = async (token: string, newPassword: string) => {
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: resetTokenHash,
      passwordResetExpiresAt: { gt: new Date() },
    },
  });
  if (!user) throw new AppError('Token is invalid or has expired', 400);
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });
};

// Get Users with Pagination & Filtering
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

  const users = await prisma.user.findMany({
    where,
    skip,
    take: limit,
    select: fields.length > 0 ? selectFields : undefined,
  });

  const totalUsers = await prisma.user.count({ where });
  return { users, total: totalUsers };
};

export const issueRefreshToken = async (userId: string, ip = 'system') => {
  const raw = crypto.randomBytes(48).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');

  const expiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.refres;
};
