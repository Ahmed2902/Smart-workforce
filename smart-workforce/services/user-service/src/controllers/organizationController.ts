import { Request, Response, NextFunction } from 'express';
import * as orgService from '../services/organizationService';

export const createOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requester = (req as any).user;
    const org = await orgService.createOrganization(req.body, requester);
    res.status(201).json({ status: 'success', data: org });
  } catch (err: any) {
    next(err);
  }
};

export const getOrginzations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const orgs = await orgService.getOrganizations();
    res.status(200).json({ status: 'success', data: orgs });
  } catch (err: any) {
    next(err);
  }
};

export const updateOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const org = await orgService.updateOrganization(id, req.body);
    res.status(200).json({ status: 'success', data: org });
  } catch (err: any) {
    next(err);
  }
};

export const deleteOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    await orgService.deleteOrganization(id);
    res.json({ message: 'Organization deleted' });
  } catch (err: any) {
    // service throws with message when cannot delete
    if (err.message && err.message.includes('Cannot delete organization')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};
