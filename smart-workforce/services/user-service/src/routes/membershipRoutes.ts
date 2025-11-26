import { Router } from 'express';
import * as membershipController from '../controllers/organizationMembershipController';

const router = Router();

// Add member to organization
router.post(
  '/organizations/:organizationId/members',
  membershipController.addMember,
);

// Update member role
router.put(
  '/organizations/:organizationId/members/:userId',
  membershipController.updateMemberRole,
);

// Remove member from organization
router.delete(
  '/organizations/:organizationId/members/:userId',
  membershipController.removeMember,
);

// Get organization members
router.get(
  '/organizations/:organizationId/members',
  membershipController.getOrganizationMembers,
);

// Get user memberships
router.get(
  '/users/:userId/memberships',
  membershipController.getUserMemberships,
);

export default router;
