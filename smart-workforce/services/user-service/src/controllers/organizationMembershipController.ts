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
    const requester = (req as any).user;

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId is required',
      });
    }

    const membership = await membershipService.addUserToOrganization(
      requester,
      userId,
      organizationId,
      role as Role,
    );

    res.status(201).json({
      status: 'success',
      data: membership,
    });
  } catch (err) {
    if (
      (err as Error).message?.includes('Only organization admins') ||
      (err as Error).message?.includes('Organization membership not found') ||
      (err as Error).message?.includes('Requester not found')
    ) {
      return res.status(403).json({
        status: 'error',
        message: (err as Error).message,
      });
    }
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
    const requester = (req as any).user;

    if (!role) {
      return res.status(400).json({
        status: 'error',
        message: 'role is required',
      });
    }

    const membership = await membershipService.updateMembershipRole(
      requester,
      userId,
      organizationId,
      role as Role,
    );

    res.status(200).json({
      status: 'success',
      data: membership,
    });
  } catch (err) {
    if (
      (err as Error).message?.includes('Only organization admins') ||
      (err as Error).message?.includes('Organization membership not found') ||
      (err as Error).message?.includes('Requester not found')
    ) {
      return res.status(403).json({
        status: 'error',
        message: (err as Error).message,
      });
    }
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
    const requester = (req as any).user;

    await membershipService.removeUserFromOrganization(
      requester,
      userId,
      organizationId,
    );

    res.status(204).send();
  } catch (err) {
    if (
      (err as Error).message?.includes('Only organization admins') ||
      (err as Error).message?.includes('Organization membership not found') ||
      (err as Error).message?.includes('Requester not found')
    ) {
      return res.status(403).json({
        status: 'error',
        message: (err as Error).message,
      });
    }
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
    const requester = (req as any).user;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { memberships, total } =
      await membershipService.getOrganizationMembers(
        requester,
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
    if (
      (err as Error).message?.includes('Only organization admins') ||
      (err as Error).message?.includes('Organization membership not found') ||
      (err as Error).message?.includes('Requester not found')
    ) {
      return res.status(403).json({
        status: 'error',
        message: (err as Error).message,
      });
    }
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
    const requester = (req as any).user;

    if (
      requester?.systemRole !== 'SUPERADMIN' &&
      requester?.id !== userId
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: insufficient permissions',
      });
    }

    const memberships = await membershipService.getUserMemberships(userId);

    res.status(200).json({
      status: 'success',
      data: memberships,
    });
  } catch (err) {
    next(err);
  }
};
