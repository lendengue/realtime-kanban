import { describe, expect, it } from 'vitest';

import { can, type Permission, type WorkspaceRole } from './roles.js';

const matrix: Record<Permission, Record<WorkspaceRole, boolean>> = {
  'workspace:view': { owner: true, admin: true, member: true, viewer: true },
  'boards:edit': { owner: true, admin: true, member: true, viewer: false },
  'boards:manage': { owner: true, admin: true, member: true, viewer: false },
  'workspace:rename': { owner: true, admin: true, member: false, viewer: false },
  'members:manage': { owner: true, admin: true, member: false, viewer: false },
  'workspace:delete': { owner: true, admin: false, member: false, viewer: false },
};

describe('can', () => {
  for (const [permission, roles] of Object.entries(matrix)) {
    for (const [role, expected] of Object.entries(roles)) {
      it(`${role} ${expected ? 'can' : 'cannot'} ${permission}`, () => {
        expect(can(role as WorkspaceRole, permission as Permission)).toBe(expected);
      });
    }
  }
});
