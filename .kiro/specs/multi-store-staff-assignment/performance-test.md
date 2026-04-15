# Performance Testing Guide

## Overview
This guide provides instructions for testing the multi-store staff assignment feature under load with large datasets.

## Test Environment Setup

### Database Seeding Requirements
- **100+ stores**: Create stores with realistic names and codes
- **1000+ staff**: Create staff users with various assignment patterns
- **10,000+ sales records**: Distributed across stores and time periods
- **5,000+ inventory records**: Products distributed across stores

### Seeding Script

```sql
-- Create 150 stores
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..150 LOOP
    INSERT INTO stores (id, name, code, address, phone, created_at)
    VALUES (
      gen_random_uuid(),
      'Store ' || i,
      'ST' || LPAD(i::TEXT, 4, '0'),
      'Address ' || i,
      '+62-' || (1000000000 + i)::TEXT,
      NOW()
    );
  END LOOP;
END $$;

-- Create 1200 staff users with assignments
DO $$
DECLARE
  i INTEGER;
  staff_uuid UUID;
  store_ids UUID[];
  num_stores INTEGER;
  j INTEGER;
BEGIN
  -- Get all store IDs
  SELECT ARRAY_AGG(id) INTO store_ids FROM stores WHERE deleted_at IS NULL;
  
  FOR i IN 1..1200 LOOP
    -- Create staff profile
    staff_uuid := gen_random_uuid();
    
    INSERT INTO profiles (id, email, name, role, created_at)
    VALUES (
      staff_uuid,
      'staff' || i || '@test.com',
      'Staff Member ' || i,
      'staff',
      NOW()
    );
    
    -- Assign random number of stores (1-5)
    num_stores := 1 + (random() * 4)::INTEGER;
    
    FOR j IN 1..num_stores LOOP
      INSERT INTO staff_stores (staff_id, store_id, is_primary, assigned_at)
      VALUES (
        staff_uuid,
        store_ids[(random() * (array_length(store_ids, 1) - 1))::INTEGER + 1],
        j = 1, -- First assignment is primary
        NOW()
      )
      ON CONFLICT (staff_id, store_id) DO NOTHING;
    END LOOP;
    
    -- Update profiles.store_id with primary store
    UPDATE profiles
    SET store_id = (
      SELECT store_id FROM staff_stores 
      WHERE staff_id = staff_uuid AND is_primary = true 
      LIMIT 1
    )
    WHERE id = staff_uuid;
  END LOOP;
END $$;

-- Create 15,000 sales records
DO $$
DECLARE
  i INTEGER;
  store_ids UUID[];
  staff_ids UUID[];
  product_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO store_ids FROM stores WHERE deleted_at IS NULL;
  SELECT ARRAY_AGG(id) INTO staff_ids FROM profiles WHERE role = 'staff';
  SELECT ARRAY_AGG(id) INTO product_ids FROM products WHERE deleted_at IS NULL LIMIT 100;
  
  FOR i IN 1..15000 LOOP
    INSERT INTO sales (
      store_id,
      product_id,
      quantity,
      unit_price,
      total_price,
      sale_date,
      created_by,
      created_at
    )
    VALUES (
      store_ids[(random() * (array_length(store_ids, 1) - 1))::INTEGER + 1],
      product_ids[(random() * (array_length(product_ids, 1) - 1))::INTEGER + 1],
      (1 + random() * 10)::INTEGER,
      50000 + (random() * 200000)::INTEGER,
      0, -- Will be calculated
      NOW() - (random() * 365 || ' days')::INTERVAL,
      staff_ids[(random() * (array_length(staff_ids, 1) - 1))::INTEGER + 1],
      NOW()
    );
  END LOOP;
  
  -- Update total_price
  UPDATE sales SET total_price = quantity * unit_price WHERE total_price = 0;
END $$;

-- Create 8,000 inventory records
DO $$
DECLARE
  i INTEGER;
  store_ids UUID[];
  product_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO store_ids FROM stores WHERE deleted_at IS NULL;
  SELECT ARRAY_AGG(id) INTO product_ids FROM products WHERE deleted_at IS NULL;
  
  FOR i IN 1..8000 LOOP
    INSERT INTO inventory (
      store_id,
      product_id,
      quantity,
      last_updated,
      created_at
    )
    VALUES (
      store_ids[(random() * (array_length(store_ids, 1) - 1))::INTEGER + 1],
      product_ids[(random() * (array_length(product_ids, 1) - 1))::INTEGER + 1],
      (random() * 100)::INTEGER,
      NOW(),
      NOW()
    )
    ON CONFLICT (store_id, product_id) DO UPDATE
    SET quantity = EXCLUDED.quantity;
  END LOOP;
END $$;
```

## Performance Test Scenarios

### Test 1: Query Performance - Store Assignment Lookup

**Objective**: Verify fast retrieval of staff store assignments

**Test Query**:
```sql
EXPLAIN ANALYZE
SELECT store_id, is_primary
FROM staff_stores
WHERE staff_id = '<test_staff_id>';
```

**Success Criteria**:
- Query execution time < 5ms
- Uses index on staff_id
- No sequential scans

**Expected Plan**:
```
Index Scan using idx_staff_stores_staff_id on staff_stores
  Index Cond: (staff_id = '<uuid>')
  Planning Time: 0.1ms
  Execution Time: 1-3ms
```

---

### Test 2: Query Performance - Helper Function

**Objective**: Verify get_user_store_ids function performance

**Test Query**:
```sql
EXPLAIN ANALYZE
SELECT get_user_store_ids('<test_staff_id>');
```

**Success Criteria**:
- Function execution time < 10ms
- Efficient array aggregation
- Uses indexes appropriately

**Benchmark**:
- Staff with 1 store: < 5ms
- Staff with 5 stores: < 8ms
- Staff with 10 stores: < 10ms
- Admin (all stores): < 50ms

---

### Test 3: Query Performance - RLS Filtered Sales Query

**Objective**: Verify sales query performance with RLS

**Test Query**:
```sql
-- Set session to test staff
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<test_staff_id>"}';

EXPLAIN ANALYZE
SELECT s.*, st.name as store_name, p.name as product_name
FROM sales s
JOIN stores st ON s.store_id = st.id
JOIN products p ON s.product_id = p.id
WHERE s.sale_date >= NOW() - INTERVAL '30 days'
ORDER BY s.sale_date DESC
LIMIT 100;
```

**Success Criteria**:
- Query execution time < 100ms
- Uses indexes on store_id and sale_date
- RLS policy applies efficiently
- No full table scans

**Expected Performance**:
- With 15,000 sales: < 50ms
- With 50,000 sales: < 100ms
- With 100,000 sales: < 200ms

---

### Test 4: Query Performance - RLS Filtered Inventory Query

**Objective**: Verify inventory query performance with RLS

**Test Query**:
```sql
-- Set session to test staff
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<test_staff_id>"}';

EXPLAIN ANALYZE
SELECT i.*, st.name as store_name, p.name as product_name, p.sku
FROM inventory i
JOIN stores st ON i.store_id = st.id
JOIN products p ON i.product_id = p.id
WHERE i.quantity > 0
ORDER BY st.name, p.name
LIMIT 500;
```

**Success Criteria**:
- Query execution time < 100ms
- Uses indexes efficiently
- RLS policy applies without performance penalty

---

### Test 5: Session Load Time

**Objective**: Measure session initialization time with store assignments

**Test Steps**:
1. Clear all caches
2. Simulate user authentication
3. Measure time to load store assignments into session
4. Repeat for different staff profiles:
   - Staff with 1 store
   - Staff with 5 stores
   - Staff with 10 stores
   - Admin (all stores)

**Success Criteria**:
- Staff with 1-5 stores: < 50ms
- Staff with 10 stores: < 100ms
- Admin (150 stores): < 200ms

**Measurement Script**:
```typescript
// scripts/measure-session-load.ts
import { createClient } from '@/lib/supabase/server';

async function measureSessionLoad(userId: string) {
  const start = performance.now();
  
  const supabase = await createClient();
  
  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, store_id')
    .eq('id', userId)
    .single();
  
  // Load assignments
  const { data: assignments } = await supabase
    .from('staff_stores')
    .select('store_id, is_primary')
    .eq('staff_id', userId);
  
  const end = performance.now();
  
  console.log(`Session load time: ${(end - start).toFixed(2)}ms`);
  console.log(`Assignments loaded: ${assignments?.length || 0}`);
  
  return end - start;
}

// Test with different users
const testUsers = [
  { id: 'staff-1-store', expected: 50 },
  { id: 'staff-5-stores', expected: 100 },
  { id: 'staff-10-stores', expected: 100 },
  { id: 'admin-all-stores', expected: 200 },
];

for (const user of testUsers) {
  const time = await measureSessionLoad(user.id);
  console.log(`${user.id}: ${time}ms (expected < ${user.expected}ms)`);
  console.assert(time < user.expected, `Performance degradation for ${user.id}`);
}
```

---

### Test 6: Assignment Modification Performance

**Objective**: Measure time to modify store assignments

**Test Operations**:
1. Assign new store to staff
2. Remove store from staff
3. Change primary store
4. Bulk assign stores to multiple staff

**Success Criteria**:
- Single assignment: < 100ms
- Remove assignment: < 100ms
- Change primary: < 150ms
- Bulk assign (10 staff): < 1000ms

**Measurement Script**:
```typescript
// scripts/measure-assignment-ops.ts
import { assignStoreToStaff, removeStoreFromStaff, setPrimaryStore } from '@/actions/store-assignments';

async function measureAssignmentOps() {
  // Test 1: Assign store
  const start1 = performance.now();
  await assignStoreToStaff('test-staff-id', 'test-store-id', false);
  const time1 = performance.now() - start1;
  console.log(`Assign store: ${time1.toFixed(2)}ms`);
  
  // Test 2: Change primary
  const start2 = performance.now();
  await setPrimaryStore('test-staff-id', 'test-store-id');
  const time2 = performance.now() - start2;
  console.log(`Change primary: ${time2.toFixed(2)}ms`);
  
  // Test 3: Remove store
  const start3 = performance.now();
  await removeStoreFromStaff('test-staff-id', 'test-store-id');
  const time3 = performance.now() - start3;
  console.log(`Remove store: ${time3.toFixed(2)}ms`);
  
  // Assertions
  console.assert(time1 < 100, 'Assign operation too slow');
  console.assert(time2 < 150, 'Primary change too slow');
  console.assert(time3 < 100, 'Remove operation too slow');
}
```

---

### Test 7: Concurrent User Load

**Objective**: Test system under concurrent user load

**Test Setup**:
- Simulate 50 concurrent users
- Each user performs typical operations:
  - View sales (5 requests)
  - View inventory (3 requests)
  - Create sale (1 request)
  - Switch store context (2 requests)

**Success Criteria**:
- Average response time < 200ms
- 95th percentile < 500ms
- 99th percentile < 1000ms
- No database connection pool exhaustion
- No timeout errors

**Load Test Script** (using k6 or similar):
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50, // 50 virtual users
  duration: '5m', // 5 minute test
};

export default function () {
  // Login
  const loginRes = http.post('http://localhost:3000/api/auth/login', {
    email: 'staff@test.com',
    password: 'password',
  });
  
  const token = loginRes.json('token');
  const headers = { Authorization: `Bearer ${token}` };
  
  // View sales
  const salesRes = http.get('http://localhost:3000/api/sales', { headers });
  check(salesRes, { 'sales loaded': (r) => r.status === 200 });
  
  sleep(1);
  
  // View inventory
  const invRes = http.get('http://localhost:3000/api/inventory', { headers });
  check(invRes, { 'inventory loaded': (r) => r.status === 200 });
  
  sleep(1);
  
  // Create sale
  const saleRes = http.post('http://localhost:3000/api/sales', {
    store_id: 'test-store-id',
    product_id: 'test-product-id',
    quantity: 1,
    unit_price: 100000,
  }, { headers });
  check(saleRes, { 'sale created': (r) => r.status === 201 });
  
  sleep(2);
}
```

---

### Test 8: Index Effectiveness

**Objective**: Verify all indexes are being used

**Test Queries**:
```sql
-- Check index usage on staff_stores
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'staff_stores'
ORDER BY idx_scan DESC;

-- Check for sequential scans (should be minimal)
SELECT schemaname, tablename, seq_scan, seq_tup_read, 
       idx_scan, idx_tup_fetch,
       seq_scan::float / NULLIF(idx_scan, 0) as seq_to_idx_ratio
FROM pg_stat_user_tables
WHERE tablename IN ('staff_stores', 'sales', 'inventory')
ORDER BY seq_scan DESC;
```

**Success Criteria**:
- All indexes show usage (idx_scan > 0)
- Sequential scan ratio < 0.1 (10% of index scans)
- Primary key and foreign key indexes heavily used

---

### Test 9: Memory Usage

**Objective**: Verify reasonable memory consumption

**Test Steps**:
1. Monitor database memory usage
2. Monitor application memory usage
3. Perform operations with large datasets
4. Check for memory leaks

**Success Criteria**:
- Database shared buffers usage < 80%
- Application memory stable (no leaks)
- No out-of-memory errors
- Garbage collection frequency normal

**Monitoring Query**:
```sql
-- Check database memory usage
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as db_size,
  pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as tables_size
FROM pg_tables
WHERE schemaname = 'public';

-- Check cache hit ratio (should be > 95%)
SELECT 
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;
```

---

### Test 10: Stress Test - Maximum Assignments

**Objective**: Test edge case with maximum store assignments

**Test Setup**:
- Create staff with 50 store assignments
- Create staff with 100 store assignments
- Perform typical operations

**Success Criteria**:
- Operations complete successfully
- Performance degradation < 2x normal
- No errors or timeouts
- UI remains responsive

---

## Performance Benchmarks Summary

| Metric | Target | Acceptable | Unacceptable |
|--------|--------|------------|--------------|
| Store assignment lookup | < 5ms | < 10ms | > 20ms |
| Helper function (5 stores) | < 8ms | < 15ms | > 30ms |
| Sales query (RLS) | < 50ms | < 100ms | > 200ms |
| Inventory query (RLS) | < 50ms | < 100ms | > 200ms |
| Session load (5 stores) | < 50ms | < 100ms | > 200ms |
| Assignment modification | < 100ms | < 200ms | > 500ms |
| Concurrent users (avg) | < 200ms | < 500ms | > 1000ms |
| Cache hit ratio | > 95% | > 90% | < 85% |

## Optimization Recommendations

If performance targets are not met:

1. **Add more indexes**:
   - Composite indexes on frequently queried columns
   - Partial indexes for common filters

2. **Optimize RLS policies**:
   - Simplify policy logic
   - Use materialized views for complex checks

3. **Implement caching**:
   - Redis for session data
   - Application-level caching for store lists

4. **Database tuning**:
   - Increase shared_buffers
   - Tune work_mem for complex queries
   - Enable parallel query execution

5. **Connection pooling**:
   - Use PgBouncer or similar
   - Optimize pool size

6. **Query optimization**:
   - Add EXPLAIN ANALYZE to slow queries
   - Rewrite inefficient queries
   - Use CTEs or subqueries strategically

## Running the Tests

1. **Setup test environment**:
   ```bash
   npm run db:seed:performance
   ```

2. **Run query performance tests**:
   ```bash
   npm run test:performance:queries
   ```

3. **Run session load tests**:
   ```bash
   npm run test:performance:session
   ```

4. **Run load tests**:
   ```bash
   k6 run load-test.js
   ```

5. **Generate performance report**:
   ```bash
   npm run test:performance:report
   ```

## Success Criteria

All performance tests must meet target benchmarks:
- ✓ Query performance within targets
- ✓ Session load times acceptable
- ✓ Concurrent user load handled
- ✓ Indexes used effectively
- ✓ Memory usage reasonable
- ✓ No performance regressions
