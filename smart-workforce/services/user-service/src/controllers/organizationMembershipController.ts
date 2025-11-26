import { Request, Response, NextFunction } from 'express';
import * as membershipService from '../services/organizationMembershipService';
import { Role } from '@prisma/client';

export const addMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { organizationId } = req.params;
    const { userId, role = 'EMPLOYEE' } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId is required',
      });
    }

    const membership = await membershipService.addUserToOrganization(
      userId,
      organizationId,
      role as Role,
    );

    res.status(201).json({
      status: 'success',
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

export const updateMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { organizationId, userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        status: 'error',
        message: 'role is required',
      });
    }

    const membership = await membershipService.updateMembershipRole(
      userId,
      organizationId,
      role as Role,
    );

    res.status(200).json({
      status: 'success',
      data: membership,
    });
  } catch (err) {
    next(err);
  }
};

export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { organizationId, userId } = req.params;

    await membershipService.removeUserFromOrganization(userId, organizationId);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const getOrganizationMembers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { organizationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { memberships, total } =
      await membershipService.getOrganizationMembers(
        organizationId,
        page,
        limit,
      );

    res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: memberships,
    });
  } catch (err) {
    next(err);
  }
};

export const getUserMemberships = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    const memberships = await membershipService.getUserMemberships(userId);

    res.status(200).json({
      status: 'success',
      data: memberships,
    });
  } catch (err) {
    next(err);
  }
};
