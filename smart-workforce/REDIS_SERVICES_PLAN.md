# Redis Integration Plan for All Services

## Executive Summary

Redis has been successfully implemented in **attendance-service**. This document outlines opportunities to extend Redis across all remaining services for consistent performance improvements.

---

## Service-by-Service Analysis & Recommendations

### 1. **Auth Service** (Port 3001)

**Current Operations**: User registration, login, password reset, token management, refresh token rotation

#### High-Impact Redis Opportunities

| Operation                      | Problem                                       | Redis Solution                                       | Priority  | Est. Impact                       |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------- | --------- | --------------------------------- |
| **Login verification**         | Each login queries user by email from DB      | Cache user records by email (30 min TTL)             | 🔴 HIGH   | 100-200ms faster logins           |
| **Refresh token validation**   | Frequent DB lookups for token verification    | Store valid tokens in Redis set (TTL = token expiry) | 🔴 HIGH   | 50-100ms faster per request       |
| **Token revocation list**      | Check if token is revoked (blacklist pattern) | Redis set of revoked tokens with TTL                 | 🔴 HIGH   | Prevents invalid tokens in system |
| **Password reset tokens**      | OTP/reset token expiration tracking           | Store reset tokens with 1-hour TTL                   | 🟡 MEDIUM | Auto-cleanup of expired tokens    |
| **Rate limiting per endpoint** | Auth endpoints vulnerable to brute force      | Redis INCR for login/register attempts               | 🟡 MEDIUM | Prevent credential stuffing       |

#### Implementation Examples

```typescript
// Cache user by email for 30 minutes
const cacheKey = `auth:user:email:${email}`;
let user = await getCache(cacheKey);
if (!user) {
  user = await prisma.authUser.findUnique({ where: { email } });
  await setCache(cacheKey, user, 1800); // 30 min
}

// Store refresh tokens (valid until expiry)
const tokenKey = `auth:token:${tokenId}`;
await setCache(tokenKey, { userId, issued: now }, tokenExpirySeconds);

// Revoke token by adding to blacklist
const blacklistKey = `auth:revoked:${tokenId}`;
await setCache(blacklistKey, '1', tokenExpirySeconds);
```

#### Configuration

```typescript
// auth-service/src/server.ts
import { initRedis } from '@swma/shared';

async function startServer() {
  await initRedis();
  // ... rest of startup
}
```

---

### 2. **User Service** (Port 3002)

**Current Operations**: User management, organization management, department management, membership roles

#### High-Impact Redis Opportunities

| Operation                     | Problem                           | Redis Solution                   | Priority  | Est. Impact                      |
| ----------------------------- | --------------------------------- | -------------------------------- | --------- | -------------------------------- |
| **User lookups**              | Frequent queries by userId/email  | Cache user profiles (1 hour TTL) | 🔴 HIGH   | 80-150ms per lookup              |
| **Organization members list** | N+1 queries for org + members     | Cache org members (10 min TTL)   | 🔴 HIGH   | 200-400ms faster bulk operations |
| **Department structure**      | Tree of orgs → depts → employees  | Cache hierarchy (30 min TTL)     | 🟡 MEDIUM | Faster org chart rendering       |
| **Role-based access checks**  | Repeated role lookups per request | Cache user roles (5 min TTL)     | 🟡 MEDIUM | 50-100ms per authorization check |
| **Membership queries**        | List all orgs user belongs to     | Cache memberships (15 min TTL)   | 🟡 MEDIUM | 100-200ms faster dashboard       |

#### Implementation Examples

```typescript
// Cache user profile
const userCacheKey = `user:${userId}:profile`;
let user = await getCache(userCacheKey);
if (!user) {
  user = await prisma.user.findUnique({ where: { id: userId } });
  await setCache(userCacheKey, user, 3600); // 1 hour
}

// Cache org members
const membersCacheKey = `org:${orgId}:members`;
let members = await getCache(membersCacheKey);
if (!members) {
  members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId },
  });
  await setCache(membersCacheKey, members, 600); // 10 min
}

// Cache user's memberships
const membershipsCacheKey = `user:${userId}:memberships`;
let memberships = await getCache(membershipsCacheKey);
if (!memberships) {
  memberships = await prisma.organizationMember.findMany({
    where: { userId },
  });
  await setCache(membershipsCacheKey, memberships, 900); // 15 min
}

// Invalidate caches when membership changes
await deleteCache(`user:${userId}:memberships`);
await deleteCache(`org:${orgId}:members`);
```

#### Cache Invalidation Strategy

```typescript
// When user is updated
await deleteCache(`user:${userId}:profile`);

// When org members change
await deleteCache(`org:${orgId}:members`);
await deleteCache(`user:${userId}:memberships`);

// When dept structure changes
await deleteCache(`org:${orgId}:depts`);
```

---

### 3. **Schedule Service** (Port 3003)

**Current Operations**: Shift management, employee scheduling, shift assignments

#### High-Impact Redis Opportunities

| Operation                       | Problem                                         | Redis Solution                              | Priority  | Est. Impact                |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------- | --------- | -------------------------- |
| **Shift queries**               | Frequent lookups for shift details              | Cache shifts by ID (2 hour TTL)             | 🔴 HIGH   | 100-200ms per lookup       |
| **Employee schedule for month** | Expensive query joining shifts + employees      | Cache monthly schedules (30 min TTL)        | 🔴 HIGH   | 500-800ms for bulk queries |
| **Shift conflicts check**       | Check if employee already assigned to time slot | Sorted set in Redis for quick range queries | 🟡 MEDIUM | 50-100ms faster validation |
| **Available shifts list**       | Query all open shifts                           | Cache available shifts (5 min TTL)          | 🟡 MEDIUM | 150-300ms faster search    |

#### Implementation Examples

```typescript
// Cache shift details (attendance service already does this)
const shiftCacheKey = `shift:${shiftId}`;
let shift = await getCache(shiftCacheKey);
if (!shift) {
  shift = await prisma.shift.findUnique({ where: { id: shiftId } });
  await setCache(shiftCacheKey, shift, 7200); // 2 hours
}

// Cache employee's monthly schedule
const scheduleCacheKey = `emp:${employeeId}:schedule:${month}`;
let schedule = await getCache(scheduleCacheKey);
if (!schedule) {
  schedule = await prisma.shift.findMany({
    where: {
      employeeId,
      date: { gte: monthStart, lt: monthEnd },
    },
    include: { shiftTemplate: true },
  });
  await setCache(scheduleCacheKey, schedule, 1800); // 30 min
}

// Cache available shifts
const availableCacheKey = `shifts:available:${date}`;
let available = await getCache(availableCacheKey);
if (!available) {
  available = await prisma.shift.findMany({
    where: { date: date, employeeId: null },
  });
  await setCache(availableCacheKey, available, 300); // 5 min
}
```

---

### 4. **Payroll Service** (Port 3004)

**Current Operations**: Payroll calculations, salary processing, deductions

#### High-Impact Redis Opportunities

| Operation                    | Problem                                | Redis Solution                          | Priority  | Est. Impact                    |
| ---------------------------- | -------------------------------------- | --------------------------------------- | --------- | ------------------------------ |
| **Payroll calculations**     | Expensive aggregations (hours × rate)  | Cache monthly payroll (10 min TTL)      | 🔴 HIGH   | 2-5 seconds faster processing  |
| **Salary structure lookups** | Repeated queries for pay scales        | Cache salary configs (1 hour TTL)       | 🟡 MEDIUM | 100-150ms per calculation      |
| **Deduction rules**          | Query tax/insurance rules per employee | Cache deduction rules (1 hour TTL)      | 🟡 MEDIUM | 50-100ms per payroll run       |
| **YTD calculations**         | Aggregate data from Jan-current month  | Cache YTD values (5 min TTL)            | 🟡 MEDIUM | 500ms-1s faster reports        |
| **Scheduled job tracking**   | Know if payroll already processed      | Use Redis key existence (task-specific) | 🟢 LOW    | Prevent duplicate payroll runs |

#### Implementation Examples

```typescript
// Cache payroll calculation for employee/month
const payrollCacheKey = `payroll:${employeeId}:${month}`;
let payroll = await getCache(payrollCacheKey);
if (!payroll) {
  // Fetch hours from attendance service
  const hours = await getEmployeeHours(employeeId, month);

  // Fetch salary structure
  const salary = await getSalaryStructure(employeeId);

  // Calculate
  const payroll = calculatePayroll(hours, salary);

  await setCache(payrollCacheKey, payroll, 600); // 10 min
}

// Cache salary structure
const salaryCacheKey = `salary:${employeeId}:structure`;
let structure = await getCache(salaryCacheKey);
if (!structure) {
  structure = await prisma.salaryStructure.findUnique({
    where: { employeeId },
  });
  await setCache(salaryCacheKey, structure, 3600); // 1 hour
}

// Prevent duplicate payroll processing
const jobKey = `payroll:job:${month}:running`;
const acquired = await acquireLock(jobKey, 600); // 10 min lock
if (!acquired) {
  throw new Error('Payroll already processing for this month');
}

try {
  // Process payroll
  await processPayroll(month);
} finally {
  await releaseLock(jobKey);
}
```

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1)

**Services**: Auth, User
**Effort**: Low (2-3 days each)
**Impact**: Immediate 50-200ms improvements across all endpoints

1. ✅ **Auth Service**: Cache user profiles + refresh token validation
2. ✅ **User Service**: Cache user lookups + org members

### Phase 2: Core Operations (Week 2)

**Services**: Schedule, Payroll
**Effort**: Medium (3-4 days each)
**Impact**: 500ms-2s improvements for heavy operations

3. **Schedule Service**: Cache shifts + monthly schedules
4. **Payroll Service**: Cache calculations + salary structures

### Phase 3: Production Hardening (Week 3)

**Effort**: Medium (2-3 days)

5. Implement cache warming on service startup
6. Add monitoring/metrics for cache hits/misses
7. Deploy to production with gradual rollout

---

## Implementation Template for Each Service

### Step 1: Add Redis to Dependencies

```bash
# In service's package.json
"redis": "^4.7.0"
```

### Step 2: Update Server.ts

```typescript
import { initRedis, closeRedis } from '@swma/shared';

async function startServer() {
  await initRedis();
  // ... rest of startup
}

process.on('SIGINT', async () => {
  await closeRedis();
  process.exit(0);
});
```

### Step 3: Create Service-Specific Cache Keys

```typescript
// Define consistent cache key patterns
export const CACHE_KEYS = {
  USER_PROFILE: (id: string) => `user:${id}:profile`,
  ORG_MEMBERS: (id: string) => `org:${id}:members`,
  SHIFT_DETAILS: (id: string) => `shift:${id}`,
  PAYROLL: (id: string, month: string) => `payroll:${id}:${month}`,
};
```

### Step 4: Wrap DB Queries with Cache

```typescript
export async function getUser(id: string) {
  const cacheKey = CACHE_KEYS.USER_PROFILE(id);

  // Try cache first
  let user = await getCache(cacheKey);
  if (user) return user;

  // Cache miss
  user = await prisma.user.findUnique({ where: { id } });
  await setCache(cacheKey, user, 3600); // 1 hour
  return user;
}
```

### Step 5: Invalidate Cache on Mutations

```typescript
export async function updateUser(id: string, data: any) {
  const result = await prisma.user.update({
    where: { id },
    data,
  });

  // Invalidate cache
  await deleteCache(CACHE_KEYS.USER_PROFILE(id));

  return result;
}
```

---

## Performance Comparison

### Before Redis (Current State)

| Operation                | Latency     | Bottleneck     |
| ------------------------ | ----------- | -------------- |
| Login                    | 200-400ms   | DB query       |
| Get user profile         | 100-200ms   | DB query       |
| List org members         | 500-1000ms  | DB query + N+1 |
| Generate payroll         | 3-5 seconds | DB aggregation |
| Check shift availability | 200-400ms   | DB query       |

### After Redis (Proposed)

| Operation                         | Latency   | Improvement      |
| --------------------------------- | --------- | ---------------- |
| Login (cached)                    | 20-50ms   | **10x faster**   |
| Get user profile (cached)         | 5-15ms    | **15x faster**   |
| List org members (cached)         | 50-100ms  | **5-10x faster** |
| Generate payroll (cached)         | 200-400ms | **10x faster**   |
| Check shift availability (cached) | 10-30ms   | **10x faster**   |

---

## Monitoring & Observability

### Cache Hit/Miss Logging

Add to all cache operations:

```typescript
console.log(`[CACHE HIT] ${cacheKey}`);
console.log(`[CACHE MISS] ${cacheKey} - fetching from DB`);
```

### Redis Metrics Dashboard

```bash
# Monitor in real-time
docker exec -it redis redis-cli MONITOR

# Check memory usage
docker exec -it redis redis-cli INFO memory

# View cache statistics
docker exec -it redis redis-cli KEYS "user:*" | wc -l
```

---

## Common Pitfalls to Avoid

❌ **Don't**: Cache without TTL (memory bloat)
✅ **Do**: Set appropriate TTLs (5 min for dynamic, 1 hour for static)

❌ **Don't**: Forget to invalidate cache on mutations
✅ **Do**: Delete cache keys when data changes

❌ **Don't**: Cache sensitive data (passwords, tokens)
✅ **Do**: Cache non-sensitive, derivable data only

❌ **Don't**: Use complex cache keys without naming convention
✅ **Do**: Use consistent pattern: `resource:id:attribute`

❌ **Don't**: Ignore cache failures
✅ **Do**: Handle cache errors gracefully (fall through to DB)

---

## Next Steps

1. **Review & Approve** this plan
2. **Start Phase 1**: Auth service (1-2 days)
3. **Test thoroughly** with load testing
4. **Document patterns** in team wiki
5. **Roll out gradually** across services
6. **Monitor metrics** before/after

---

## Questions?

- What's the expected query volume for each service?
- Are there any sensitive data concerns for caching?
- What's the acceptable cache staleness (TTL)?
- Do we need cache warming on startup?
- Should we monitor Redis memory usage?
