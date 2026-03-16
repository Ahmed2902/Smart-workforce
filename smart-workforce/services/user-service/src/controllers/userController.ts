import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const role = req.query.role as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const organizationId = req.query.organizationId as string | undefined;

    const filteringObject: any = { isActive: true };
    if (role) filteringObject.role = role;
    if (departmentId) filteringObject.departmentId = departmentId;
    if (organizationId) filteringObject.organizationId = organizationId;

    const { users, total } = await userService.getUsers(
      filteringObject,
      page,
      limit,
    );

    res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserByAuthId(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

export const DeleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    await userService.deleteUserByAuthId(id);
    res.status(204).send();
  } catch (err: any) {
    next(err);
  }
};

export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authUserId =
      (req as any).user?.authUserId || (req as any).user?.id;
    if (!authUserId)
      return res.status(400).json({ message: 'id unavailable' });
    const { name, phone } = req.body;
    const updatedUser = await userService.updateMe(authUserId, {
      name,
      phone,
    });
    res.status(200).json({ status: 'success', data: updatedUser });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { name, phone, role, departmentId, organizationId, isActive } =
      req.body;
    const user = await userService.updateUserByAuthId(id, {
      name,
      phone,
      role,
      departmentId,
      organizationId,
      isActive,
    });
    res.status(200).json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

// Debug handler to help diagnose auth/prisma mapping issues
