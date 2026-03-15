import { db } from '../infrastructure/db';
import { getFunctionsInstance } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { isManagedUserRole, type ManagedUserRole } from '@/shared/access/roleAccessMatrix';
import { logger } from '@/services/utils/loggerService';

const roleServiceLogger = logger.child('RoleService');

export interface UserRoleMap {
  [email: string]: ManagedUserRole;
}

/**
 * Service for managing user roles dynamically via Firestore.
 */
export const roleService = {
  /**
   * Fetch all configured roles from Firestore.
   */
  async getRoles(): Promise<UserRoleMap> {
    try {
      const data = await db.getDoc<UserRoleMap>('config', 'roles');
      return data || {};
    } catch (error) {
      roleServiceLogger.error('Failed to fetch roles', error);
      throw error;
    }
  },

  /**
   * Add or Update a role for a specific email.
   */
  async setRole(email: string, role: string): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();
      if (!isManagedUserRole(role)) {
        throw new Error(`Rol no asignable: ${role}`);
      }

      // We fetch the entire map, modify it locally, and replace it.
      // This is 100% safe against Firestore dot-notation (splitting emails into nested objects).
      const currentRoles = await this.getRoles();
      const updatedRoles = { ...currentRoles, [cleanEmail]: role };

      await db.setDoc('config', 'roles', updatedRoles);
      roleServiceLogger.info(`Successfully updated roles map for ${cleanEmail}`);
    } catch (error) {
      roleServiceLogger.error(`Failed to set role for ${email}`, error);
      throw error;
    }
  },

  /**
   * Remove a role configuration. The user becomes unauthorized for normal login.
   */
  async removeRole(email: string): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      const currentRoles = await this.getRoles();
      if (
        currentRoles[cleanEmail] !== undefined ||
        this.hasNestedProperty(currentRoles, cleanEmail)
      ) {
        const updatedRoles = { ...currentRoles };
        delete updatedRoles[cleanEmail];

        // Also clean up any truncated/nested garbage if it exists
        const truncated = cleanEmail.split('.')[0];
        if (updatedRoles[truncated]) delete updatedRoles[truncated];

        await db.setDoc('config', 'roles', updatedRoles);
        roleServiceLogger.info(`Successfully removed role for ${cleanEmail}`);
      }
    } catch (error) {
      roleServiceLogger.error(`Failed to remove role for ${email}`, error);
      throw error;
    }
  },

  /** Helper to check if a key exists even if it was nested by mistake */
  hasNestedProperty(obj: Record<string, unknown>, key: string): boolean {
    return key in obj;
  },

  /**
   * Force sync a user's role by calling the Cloud Function.
   * Useful when changing a role for a user who is already authorized.
   */
  async forceSyncUser(email: string, role: string): Promise<unknown> {
    const functions = await getFunctionsInstance();
    const setUserRole = httpsCallable(functions, 'setUserRole');
    return setUserRole({ email, role });
  },
};
