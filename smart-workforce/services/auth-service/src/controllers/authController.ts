import * as authServ from '../services/authService';
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/appError';
import {
  type RegisterInput,
  type LoginInput,
  type RefreshInput,
} from '../validators/authValidator';

export const register = async (req: Request, res: Response) => {
  const payload = req.body as RegisterInput;
  const { email, password, name, phone } = payload;
  if (!phone) {
    return res
      .status(400)
      .json({ status: 'fail', message: 'Phone is required' });
  }
  const user = await authServ.createUser(email, password, name, phone);
  res.status(201).json({
    status: 'succesful',
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const payload = req.body as LoginInput;
  const { email, password } = payload;
  const { user, token } = await authServ.login(email, password);

  res.status(200).json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
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
export const logout = async (req: Request, res: Response) => {
  // If using token blacklist, implement here
  res.status(200).json({ message: 'Logged out successfully.' });
};

// Restrict To (role-based access)
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role ?? '';
    if (!roles.includes(userRole)) {
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
        users: result.users,
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
    const payload = { refreshToken: req.cookies?.refreshToken } as RefreshInput;
    const { accessToken, newRefreshToken } = payload;
  } catch (err) {}
};

export const me = async (req: Request, res: Response) => {
  res.json({ user: req.user });
};
