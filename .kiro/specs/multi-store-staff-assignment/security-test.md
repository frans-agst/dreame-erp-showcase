# Security Testing Guide

## Overview
This guide provides comprehensive security testing procedures for the multi-store staff assignment feature to ensure RLS policies cannot be bypassed and authorization is enforced at all levels.

## Security Test Scenarios

### Test 1: RLS Policy Bypass Attempts

**Objective**: Verify RLS policies cannot be bypassed through direct database access

#### Test 1.1: Direct Table Access as Staff

**Test Query**:
```sql
-- Set session as staff user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<staff_user_id>", "role": "staff"}';

-- Attempt to view all staff_stores records
SELECT * FROM staff_stores;

-- Expected: Only returns records where staff_id = current user
-- Should NOT return other staff members' assignments
```

**Success Criteria**:
- ✓ Query returns only current user's assignments
- ✓ No other staff members' data visible
- ✓ RLS policy enforced automatically

**Verification**:
```sql
-- Count should match user's actual assignments
SELECT COUNT(*) FROM staff_stores WHERE staff_id = '<staff_user_id>';
-- vs
SELECT COUNT(*) FROM staff_stores; -- Should be same for staff user
```

---

#### Test 1.2: Attempt to View Non-Assigned Store Sales

**Test Query**:
```sql
-- Set session as staff with specific store assignments
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<staff_user_id>"}';

-- Get staff's assigned stores
SELECT get_user_store_ids('<staff_user_id>');
-- Returns: {store_a_id, store_b_id}

-- Attempt to query sales from non-assigned store
SELECT * FROM sales WHERE store_id = '<store_c_id>';

-- Expected: Empty result set (RLS blocks access)
```

**Success Criteria**:
- ✓ No sales from non-assigned stores returned
- ✓ RLS policy blocks unauthorized access
- ✓ No error messages that leak information

---

#### Test 1.3: Attempt to Bypass RLS with SECURITY DEFINER Function

**Test Query**:
```sql
-- Attempt to create malicious function
CREATE OR REPLACE FUNCTION bypass_rls()
RETURNS TABLE(id UUID, staff_id UUID, store_id UUID)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT id, staff_id, store_id FROM staff_stores;
END;
$$ LANGUAGE plpgsql;

-- Attempt to call it
SELECT * FROM bypass_rls();
```

**Success Criteria**:
- ✓ Function creation fails (insufficient privileges)
- ✓ If created by admin, RLS still applies to caller
- ✓ No data leakage through function

---

#### Test 1.4: SQL Injection Attempts

**Test Inputs**:
```typescript
// Attempt SQL injection in store assignment
const maliciousStoreId = "'; DROP TABLE staff_stores; --";
await assignStoreToStaff(staffId, maliciousStoreId, false);

// Attempt SQL injection in helper function
const maliciousUserId = "' OR '1'='1";
await getStaffAssignments(maliciousUserId);

// Attempt SQL injection in sales query
const maliciousFilter = "1=1 OR store_id IN (SELECT id FROM stores)";
await getSales({ storeFilter: maliciousFilter });
```

**Success Criteria**:
- ✓ All inputs properly sanitized
- ✓ Parameterized queries used
- ✓ No SQL injection possible
- ✓ Invalid UUIDs rejected

---

### Test 2: Authorization Bypass Attempts

**Objective**: Verify authorization checks cannot be bypassed at application level

#### Test 2.1: Non-Admin Attempts to Modify Assignments

**Test Code**:
```typescript
// Login as staff user
const staffClient = createClientWithAuth(staffToken);

// Attempt to assign store to another staff
const result = await assignStoreToStaff(
  'other_staff_id',
  'some_store_id',
  false
);

// Expected: Error - Unauthorized
```

**Success Criteria**:
- ✓ Operation rejected with "Unauthorized" error
- ✓ No database changes made
- ✓ Audit log shows failed attempt
- ✓ No information leakage about other users

---

#### Test 2.2: Staff Attempts to Access Admin Pages

**Test Steps**:
1. Login as staff user
2. Navigate to `/master-data/staff-assignments`
3. Verify access denied

**Test Code**:
```typescript
// Attempt direct API call
const response = await fetch('/api/staff-assignments', {
  headers: { Authorization: `Bearer ${staffToken}` }
});

// Expected: 403 Forbidden
```

**Success Criteria**:
- ✓ Page redirects or shows 403 error
- ✓ API returns 403 Forbidden
- ✓ No data returned
- ✓ Attempt logged in audit log

---

#### Test 2.3: Token Manipulation Attempts

**Test Code**:
```typescript
// Attempt to modify JWT claims
const token = getAuthToken();
const decoded = jwt.decode(token);

// Modify role to admin
decoded.role = 'admin';
const maliciousToken = jwt.sign(decoded, 'wrong-secret');

// Attempt to use modified token
const response = await fetch('/api/staff-assignments', {
  headers: { Authorization: `Bearer ${maliciousToken}` }
});

// Expected: 401 Unauthorized (invalid signature)
```

**Success Criteria**:
- ✓ Modified token rejected
- ✓ Invalid signature detected
- ✓ No access granted
- ✓ Security event logged

---

#### Test 2.4: Session Hijacking Attempts

**Test Steps**:
1. Login as staff user A
2. Copy session token
3. Attempt to use token to access staff user B's data
4. Verify access denied

**Success Criteria**:
- ✓ Session tied to specific user
- ✓ Cannot access other users' data
- ✓ Session validation enforced

---

### Test 3: Data Isolation Verification

**Objective**: Verify complete data isolation between staff members

#### Test 3.1: Cross-Staff Data Access

**Test Setup**:
- Staff A: Assigned to Store 1, Store 2
- Staff B: Assigned to Store 3, Store 4
- Create sales in all stores

**Test Code**:
```typescript
// Login as Staff A
const staffAClient = createClientWithAuth(staffAToken);

// Query all sales
const { data: salesA } = await staffAClient
  .from('sales')
  .select('*');

// Verify only Store 1 and Store 2 sales returned
const storeIds = salesA.map(s => s.store_id);
expect(storeIds.every(id => ['store1', 'store2'].includes(id))).toBe(true);
expect(storeIds.some(id => ['store3', 'store4'].includes(id))).toBe(false);
```

**Success Criteria**:
- ✓ Staff A sees only Store 1 & 2 data
- ✓ Staff B sees only Store 3 & 4 data
- ✓ No cross-contamination
- ✓ RLS enforces isolation

---

#### Test 3.2: Inventory Isolation

**Test Code**:
```typescript
// Login as Staff A
const { data: inventory } = await staffAClient
  .from('inventory')
  .select('*, stores(name)');

// Verify all inventory belongs to assigned stores
const assignedStores = ['store1', 'store2'];
expect(inventory.every(i => assignedStores.includes(i.store_id))).toBe(true);
```

**Success Criteria**:
- ✓ Complete inventory isolation
- ✓ No leakage between staff
- ✓ RLS policy effective

---

#### Test 3.3: Assignment Visibility Isolation

**Test Code**:
```typescript
// Login as Staff A
const { data: assignments } = await staffAClient
  .from('staff_stores')
  .select('*');

// Should only see own assignments
expect(assignments.every(a => a.staff_id === staffAId)).toBe(true);
expect(assignments.length).toBe(2); // Staff A has 2 stores
```

**Success Criteria**:
- ✓ Staff can only see own assignments
- ✓ Cannot enumerate other staff
- ✓ Cannot see other staff's stores

---

### Test 4: Privilege Escalation Attempts

**Objective**: Verify users cannot escalate their privileges

#### Test 4.1: Staff Attempts to Become Admin

**Test Code**:
```typescript
// Login as staff
const staffClient = createClientWithAuth(staffToken);

// Attempt to update own role
const { error } = await staffClient
  .from('profiles')
  .update({ role: 'admin' })
  .eq('id', staffId);

// Expected: RLS policy blocks update
```

**Success Criteria**:
- ✓ Update blocked by RLS
- ✓ Role remains 'staff'
- ✓ Attempt logged
- ✓ No privilege escalation

---

#### Test 4.2: Staff Attempts to Assign Stores to Self

**Test Code**:
```typescript
// Login as staff
const staffClient = createClientWithAuth(staffToken);

// Attempt to insert own assignment
const { error } = await staffClient
  .from('staff_stores')
  .insert({
    staff_id: staffId,
    store_id: 'new_store_id',
    is_primary: false
  });

// Expected: RLS policy blocks insert
```

**Success Criteria**:
- ✓ Insert blocked by RLS
- ✓ No self-assignment possible
- ✓ Only admins can assign

---

#### Test 4.3: Manager Attempts to Modify Assignments

**Test Code**:
```typescript
// Login as manager
const managerClient = createClientWithAuth(managerToken);

// Attempt to assign store to staff
const result = await assignStoreToStaff(
  'staff_id',
  'store_id',
  false
);

// Expected: Error - Unauthorized (admin only)
```

**Success Criteria**:
- ✓ Manager cannot modify assignments
- ✓ Only admin role allowed
- ✓ Authorization enforced

---

### Test 5: Information Disclosure Prevention

**Objective**: Verify no sensitive information leaks through errors or responses

#### Test 5.1: Error Message Analysis

**Test Code**:
```typescript
// Attempt unauthorized access
try {
  await assignStoreToStaff('invalid_staff_id', 'store_id', false);
} catch (error) {
  // Verify error message doesn't leak information
  expect(error.message).not.toContain('staff_id');
  expect(error.message).not.toContain('UUID');
  expect(error.message).toBe('Unauthorized');
}
```

**Success Criteria**:
- ✓ Generic error messages
- ✓ No database details leaked
- ✓ No user enumeration possible
- ✓ No stack traces in production

---

#### Test 5.2: Timing Attack Prevention

**Test Code**:
```typescript
// Measure response time for valid vs invalid user
const start1 = Date.now();
await getStaffAssignments('valid_staff_id');
const time1 = Date.now() - start1;

const start2 = Date.now();
await getStaffAssignments('invalid_staff_id');
const time2 = Date.now() - start2;

// Response times should be similar (within 50ms)
expect(Math.abs(time1 - time2)).toBeLessThan(50);
```

**Success Criteria**:
- ✓ Consistent response times
- ✓ No user enumeration via timing
- ✓ Constant-time comparisons

---

#### Test 5.3: Store Enumeration Prevention

**Test Code**:
```typescript
// Attempt to enumerate all stores
const { data: stores } = await staffClient
  .from('stores')
  .select('*');

// Staff should only see assigned stores (via joins)
// Direct store query should be restricted
```

**Success Criteria**:
- ✓ Cannot enumerate all stores
- ✓ Only see stores through assignments
- ✓ No information leakage

---

### Test 6: Session Security

**Objective**: Verify session management is secure

#### Test 6.1: Session Fixation Prevention

**Test Steps**:
1. Get session token before login
2. Login with credentials
3. Verify new session token issued
4. Old token should be invalid

**Success Criteria**:
- ✓ New session on login
- ✓ Old session invalidated
- ✓ No session fixation possible

---

#### Test 6.2: Session Timeout

**Test Steps**:
1. Login and get session token
2. Wait for session timeout period
3. Attempt to use expired token
4. Verify access denied

**Success Criteria**:
- ✓ Sessions expire after timeout
- ✓ Expired tokens rejected
- ✓ User must re-authenticate

---

#### Test 6.3: Concurrent Session Handling

**Test Steps**:
1. Login from device A
2. Login from device B with same credentials
3. Verify both sessions valid (or policy enforced)
4. Logout from device A
5. Verify device B session still valid

**Success Criteria**:
- ✓ Session policy enforced
- ✓ Logout affects correct session
- ✓ No session confusion

---

### Test 7: Input Validation

**Objective**: Verify all inputs are properly validated

#### Test 7.1: UUID Validation

**Test Inputs**:
```typescript
const invalidInputs = [
  'not-a-uuid',
  '12345',
  '',
  null,
  undefined,
  'DROP TABLE staff_stores',
  '../../../etc/passwd',
  '<script>alert("xss")</script>',
];

for (const input of invalidInputs) {
  const result = await assignStoreToStaff(input, 'valid_store_id', false);
  expect(result.success).toBe(false);
  expect(result.error).toContain('Invalid');
}
```

**Success Criteria**:
- ✓ All invalid UUIDs rejected
- ✓ Proper error messages
- ✓ No processing of invalid input

---

#### Test 7.2: Boolean Validation

**Test Code**:
```typescript
const invalidBooleans = ['true', 'false', 1, 0, 'yes', 'no'];

for (const input of invalidBooleans) {
  const result = await assignStoreToStaff(
    'staff_id',
    'store_id',
    input // Should be boolean
  );
  // Should handle gracefully or reject
}
```

**Success Criteria**:
- ✓ Type validation enforced
- ✓ Invalid types rejected or coerced safely

---

### Test 8: Audit Log Security

**Objective**: Verify audit logs cannot be tampered with

#### Test 8.1: Audit Log Modification Attempts

**Test Code**:
```typescript
// Attempt to modify audit log as staff
const { error } = await staffClient
  .from('audit_log')
  .update({ details: 'modified' })
  .eq('id', 'some_audit_id');

// Expected: RLS blocks update
```

**Success Criteria**:
- ✓ Audit logs immutable
- ✓ Only system can write
- ✓ No user modifications allowed

---

#### Test 8.2: Audit Log Deletion Attempts

**Test Code**:
```typescript
// Attempt to delete audit log
const { error } = await staffClient
  .from('audit_log')
  .delete()
  .eq('id', 'some_audit_id');

// Expected: RLS blocks delete
```

**Success Criteria**:
- ✓ Audit logs cannot be deleted
- ✓ Permanent record maintained
- ✓ Compliance requirements met

---

### Test 9: API Security

**Objective**: Verify API endpoints are properly secured

#### Test 9.1: CORS Policy

**Test Code**:
```typescript
// Attempt cross-origin request
const response = await fetch('https://api.example.com/staff-assignments', {
  method: 'POST',
  headers: {
    'Origin': 'https://malicious-site.com',
    'Authorization': `Bearer ${token}`
  }
});

// Expected: CORS policy blocks request
```

**Success Criteria**:
- ✓ CORS policy enforced
- ✓ Only allowed origins accepted
- ✓ Credentials not sent to unauthorized origins

---

#### Test 9.2: Rate Limiting

**Test Code**:
```typescript
// Attempt rapid requests
const promises = [];
for (let i = 0; i < 100; i++) {
  promises.push(getStaffAssignments('staff_id'));
}

const results = await Promise.all(promises);
const rateLimited = results.some(r => r.status === 429);

// Expected: Some requests rate limited
```

**Success Criteria**:
- ✓ Rate limiting enforced
- ✓ Prevents brute force
- ✓ Prevents DoS attacks

---

#### Test 9.3: HTTPS Enforcement

**Test Steps**:
1. Attempt HTTP request (not HTTPS)
2. Verify redirect to HTTPS or rejection

**Success Criteria**:
- ✓ HTTPS required
- ✓ HTTP requests redirected or blocked
- ✓ Secure communication enforced

---

### Test 10: Defense in Depth

**Objective**: Verify multiple layers of security

#### Test 10.1: RLS + Application Authorization

**Test Code**:
```typescript
// Even if application check bypassed, RLS should block
// Simulate bypassing application check
const directDbQuery = await supabase
  .from('staff_stores')
  .insert({
    staff_id: 'other_staff_id',
    store_id: 'store_id',
    is_primary: false
  });

// Expected: RLS still blocks
```

**Success Criteria**:
- ✓ RLS provides defense-in-depth
- ✓ Multiple security layers
- ✓ No single point of failure

---

#### Test 10.2: Client-Side + Server-Side Validation

**Test Code**:
```typescript
// Bypass client-side validation
const maliciousData = {
  staff_id: 'invalid',
  store_id: 'invalid',
  is_primary: 'not-a-boolean'
};

// Send directly to API
const response = await fetch('/api/assign-store', {
  method: 'POST',
  body: JSON.stringify(maliciousData)
});

// Expected: Server-side validation catches it
```

**Success Criteria**:
- ✓ Server-side validation enforced
- ✓ Client-side bypass ineffective
- ✓ All inputs validated on server

---

## Security Checklist

### Authentication & Authorization
- [ ] JWT tokens properly signed and verified
- [ ] Token expiration enforced
- [ ] Role-based access control working
- [ ] Admin-only operations protected
- [ ] Session management secure

### Data Access Control
- [ ] RLS policies enforced on all tables
- [ ] Staff can only see assigned stores
- [ ] Admins can see all data
- [ ] No data leakage between users
- [ ] Helper function secure

### Input Validation
- [ ] All UUIDs validated
- [ ] SQL injection prevented
- [ ] XSS prevention in place
- [ ] Type validation enforced
- [ ] Boundary conditions handled

### Information Security
- [ ] Error messages don't leak info
- [ ] No user enumeration possible
- [ ] Timing attacks prevented
- [ ] Audit logs immutable
- [ ] Sensitive data encrypted

### API Security
- [ ] CORS policy enforced
- [ ] Rate limiting in place
- [ ] HTTPS required
- [ ] CSRF protection enabled
- [ ] API authentication required

### Database Security
- [ ] RLS enabled on all tables
- [ ] Proper indexes for performance
- [ ] CASCADE deletes configured
- [ ] Constraints enforced
- [ ] Backup and recovery tested

## Automated Security Testing

### Running Security Tests

```bash
# Run all security tests
npm run test:security

# Run specific security test suite
npm run test:security:rls
npm run test:security:auth
npm run test:security:injection

# Run penetration testing tools
npm run test:security:pentest
```

### Security Scanning Tools

1. **OWASP ZAP**: Web application security scanner
2. **SQLMap**: SQL injection testing
3. **Burp Suite**: Security testing platform
4. **npm audit**: Dependency vulnerability scanning

```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

## Security Incident Response

If a security issue is discovered:

1. **Immediate Actions**:
   - Document the issue
   - Assess severity
   - Contain the breach
   - Notify stakeholders

2. **Investigation**:
   - Review audit logs
   - Identify affected users
   - Determine scope of breach
   - Collect evidence

3. **Remediation**:
   - Patch vulnerability
   - Update security policies
   - Reset affected credentials
   - Deploy fixes

4. **Post-Incident**:
   - Conduct post-mortem
   - Update security procedures
   - Improve monitoring
   - Document lessons learned

## Success Criteria

All security tests must pass:
- ✓ No RLS bypass possible
- ✓ Authorization enforced at all levels
- ✓ Data isolation complete
- ✓ No privilege escalation
- ✓ Input validation working
- ✓ Audit logs secure
- ✓ API endpoints protected
- ✓ Defense in depth implemented
- ✓ No critical vulnerabilities
- ✓ Compliance requirements met
