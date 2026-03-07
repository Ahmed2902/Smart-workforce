import authServ from '../services/authService';
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import {
  type RegisterInput,
  type LoginInput,
  type RefreshInput,
} from '../validators/authValidator';
import { publishAuthUserCreated } from '../events/rabbit';

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payload = req.body as RegisterInput;
    const { email, password, name, phone } = payload;
    if (!phone) {
      return res
        .status(400)
        .json({ status: 'fail', message: 'Phone is required' });
    }
    const user = await authServ.createUser(email, password, name, phone);
    // publish the auth user plus the original name and phone so other services can use them
    await publishAuthUserCreated({ ...user, name, phone });
    res.status(201).json({
      status: 'succesful',
      data: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response) => {
  const payload = req.body as LoginInput;
  const { email, password } = payload;
  const { authUser, token, refreshToken } = await authServ.login(
    email,
    password,
  );

  res.cookie('jwt', token, {
    httpOnly: true, // prevents JS access (XSS protection)
    secure: true, // send only over HTTPS
    sameSite: 'strict', // CSRF protection
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  res.status(200).json({
    token,
    authUser: {
      id: authUser.id,
      email: authUser.email,
      refreshTokens: refreshToken,
    },
  });
};
// Forgot Password
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;
    await authServ.forgotPassword(email);
    res.status(200).json({ message: 'Password reset link sent to email.' });
  } catch (err) {
    next(err);
  }
};

// Reset Password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, password } = req.body;
    await authServ.resetPassword(token, password);
    res.status(200).json({ message: 'Password reset successful.' });
  } catch (err) {
    next(err);
  }
};

// Logout (for JWT, usually handled client-side, but can blacklist token)
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawRefresh =
      (req.cookies && req.cookies.refreshToken) || req.body?.refreshToken;
    if (rawRefresh) {
      await authServ.revokeRefreshToken(rawRefresh, req.ip);
    }

    // clear cookie
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};
// Restrict To (role-based access)
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUserRole = req.authUser?.role ?? '';
    if (!roles.includes(authUserRole)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
};

// Pagination & Filtering with field limiting and additional filters
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      fields = '',
      role,
      isActive,
    } = req.query;

    const fieldsArray = fields ? String(fields).split(',') : [];

    const result = await authServ.getUsers({
      page: Number(page),
      limit: Number(limit),
      search: String(search),
      fields: fieldsArray,
      role: role ? String(role) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    });

    res.status(200).json({
      status: 'success',
      data: {
        authUsers: result.authUsers,
        pagination: {
          total: result.total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(result.total / Number(limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rawRefresh =
      (req.cookies && req.cookies.refreshToken) || req.body?.refreshToken;
    if (!rawRefresh) throw new AppError('No refresh token provided', 401);

    const { accessToken, newRefreshToken } = await authServ.rotateRefreshToken(
      rawRefresh,
      req.ip,
    );

    const secure = String(process.env.COOKIE_SECURE || 'false') === 'true';

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      token: accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: Request, res: Response) => {
  res.json({ authUser: req.authUser });
};

export const getActiveSessions = async (req: Request, res: Response) => {
  const id = req.authUser?.id;
  if (!id) throw new AppError('id not found', 404);
  return await authServ.getActiveSessions(id);
};

export const revokeSession = async (req: Request, res: Response) => {
  const id = req.refreshToken?.sessionId;
  if (!id) throw new AppError('id not found', 404);
  return await authServ.revokeSession(id);
};

export const revokeAllSessionsExcept = async (req: Request, res: Response) => {
  const sessionId = req.refreshToken?.sessionId;
  const userId = req.authUser?.id;
  if (!sessionId || !userId) throw new AppError('id not found', 404);
  return await authServ.revokeAllSessionsExcept(userId, sessionId);
};
