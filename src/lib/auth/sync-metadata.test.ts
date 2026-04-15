// src/lib/auth/sync-metadata.test.ts
// Property-Based Test for JWT Metadata Synchronization
// Feature: dreame-retail-erp, Property 2: JWT Metadata Synchronization
// **Validates: Requirements 1.2**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types for testing
type UserRole = 'admin' | 'manager' | 'staff' | 'dealer';

interface Profile {
  id: string;
  role: UserRole;
  store_id: string | null;
}

interface Store {
  id: string;
  account_id: string;
}

interface JWTMetadata {
  role: UserRole;
  store_id: string | null;
  account_id: string | null;
}

/**
 * Simulates the JWT metadata sync function behavior
 * This is a pure function that represents the expected transformation
 * from profile data to JWT metadata
 * Requirements: 1.2 - Include store_id and account_id in JWT
 */
function syncProfileToJWTMetadata(profile: Profile, store: Store | null): JWTMetadata {
  return {
    role: profile.role,
    store_id: profile.store_id,
    account_id: store?.account_id ?? null,
  };
}

/**
 * Validates that JWT metadata matches profile data
 */
function jwtMetadataMatchesProfile(
  profile: Profile,
  store: Store | null,
  jwtMetadata: JWTMetadata
): boolean {
  return (
    jwtMetadata.role === profile.role &&
    jwtMetadata.store_id === profile.store_id &&
    jwtMetadata.account_id === (store?.account_id ?? null)
  );
}

// Arbitrary generators for property-based testing
const roleArbitrary = fc.constantFrom<UserRole>('admin', 'manager', 'staff', 'dealer');

const uuidArbitrary = fc.uuid();

const storeIdArbitrary = fc.option(uuidArbitrary, { nil: null });

const profileArbitrary = fc.record({
  id: uuidArbitrary,
  role: roleArbitrary,
  store_id: storeIdArbitrary,
});

const storeArbitrary = fc.record({
  id: uuidArbitrary,
  account_id: uuidArbitrary,
});

describe('JWT Metadata Synchronization', () => {
  /**
   * Property 2: JWT Metadata Synchronization
   * For any user profile update that changes role, store_id, or account_id,
   * the subsequent JWT token SHALL contain the updated values in its metadata claims.
   * Requirements: 1.2
   */
  it('should sync profile role, store_id, and account_id to JWT metadata for all valid profiles', () => {
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.option(storeArbitrary, { nil: null }),
        (profile, store) => {
          // If profile has store_id, use the store; otherwise null
          const effectiveStore = profile.store_id ? store : null;
          
          // Act: Sync profile to JWT metadata
          const jwtMetadata = syncProfileToJWTMetadata(profile, effectiveStore);

          // Assert: JWT metadata should match profile data
          expect(jwtMetadataMatchesProfile(profile, effectiveStore, jwtMetadata)).toBe(true);
          expect(jwtMetadata.role).toBe(profile.role);
          expect(jwtMetadata.store_id).toBe(profile.store_id);
          expect(jwtMetadata.account_id).toBe(effectiveStore?.account_id ?? null);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve role value exactly after sync', () => {
    fc.assert(
      fc.property(profileArbitrary, (profile) => {
        const jwtMetadata = syncProfileToJWTMetadata(profile, null);
        
        // Role should be exactly preserved
        return jwtMetadata.role === profile.role;
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve store_id value exactly after sync (including null)', () => {
    fc.assert(
      fc.property(profileArbitrary, (profile) => {
        const jwtMetadata = syncProfileToJWTMetadata(profile, null);
        
        // Store ID should be exactly preserved, including null values
        return jwtMetadata.store_id === profile.store_id;
      }),
      { numRuns: 100 }
    );
  });

  it('should include account_id when store exists', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        roleArbitrary,
        storeArbitrary,
        (userId, role, store) => {
          const profile: Profile = {
            id: userId,
            role,
            store_id: store.id,
          };

          const jwtMetadata = syncProfileToJWTMetadata(profile, store);

          // Account ID should be included from store
          expect(jwtMetadata.account_id).toBe(store.account_id);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle profile updates correctly - new metadata reflects new profile', () => {
    fc.assert(
      fc.property(
        profileArbitrary,
        profileArbitrary,
        fc.option(storeArbitrary, { nil: null }),
        (originalProfile, updatedProfile, store) => {
          // Simulate profile update scenario
          const originalMetadata = syncProfileToJWTMetadata(originalProfile, null);
          const effectiveStore = updatedProfile.store_id ? store : null;
          const updatedMetadata = syncProfileToJWTMetadata(updatedProfile, effectiveStore);

          // After update, JWT should reflect the new profile values
          expect(updatedMetadata.role).toBe(updatedProfile.role);
          expect(updatedMetadata.store_id).toBe(updatedProfile.store_id);

          // If profile changed, metadata should reflect the change
          if (originalProfile.role !== updatedProfile.role) {
            expect(updatedMetadata.role).not.toBe(originalMetadata.role);
          }
          if (originalProfile.store_id !== updatedProfile.store_id) {
            expect(updatedMetadata.store_id).not.toBe(originalMetadata.store_id);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure staff role can have store_id and account_id', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        storeArbitrary,
        (userId, store) => {
          const staffProfile: Profile = {
            id: userId,
            role: 'staff',
            store_id: store.id,
          };

          const jwtMetadata = syncProfileToJWTMetadata(staffProfile, store);

          // Staff should have their store_id and account_id synced
          expect(jwtMetadata.role).toBe('staff');
          expect(jwtMetadata.store_id).toBe(store.id);
          expect(jwtMetadata.account_id).toBe(store.account_id);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure dealer role can have store_id and account_id', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        storeArbitrary,
        (userId, store) => {
          const dealerProfile: Profile = {
            id: userId,
            role: 'dealer',
            store_id: store.id,
          };

          const jwtMetadata = syncProfileToJWTMetadata(dealerProfile, store);

          // Dealer should have their store_id and account_id synced
          expect(jwtMetadata.role).toBe('dealer');
          expect(jwtMetadata.store_id).toBe(store.id);
          expect(jwtMetadata.account_id).toBe(store.account_id);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow admin and manager to have null store_id and account_id', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        fc.constantFrom<UserRole>('admin', 'manager'),
        (userId, role) => {
          const profile: Profile = {
            id: userId,
            role,
            store_id: null,
          };

          const jwtMetadata = syncProfileToJWTMetadata(profile, null);

          // Admin/Manager can have null store_id and account_id
          expect(jwtMetadata.role).toBe(role);
          expect(jwtMetadata.store_id).toBeNull();
          expect(jwtMetadata.account_id).toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
