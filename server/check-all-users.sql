-- Check all users in the database
SELECT 
    u.id,
    u.email,
    u."firstName",
    u."lastName",
    u.role,
    u."isActive",
    u.credits,
    u."googleId",
    u."createdAt",
    u."lastLoginAt",
    COUNT(DISTINCT s.id) as active_sessions,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT j.id) as total_jobs
FROM "User" u
LEFT JOIN "Session" s ON s."userId" = u.id
LEFT JOIN "Transaction" t ON t."userId" = u.id
LEFT JOIN "Job" j ON j."userId" = u.id
GROUP BY u.id
ORDER BY u."createdAt" DESC;

-- Count total users by role
SELECT 
    role,
    COUNT(*) as user_count,
    SUM(credits) as total_credits
FROM "User"
GROUP BY role;

-- Check for any orphaned sessions (sessions without users)
SELECT 
    s.id as session_id,
    s."userId",
    s.token,
    s."expiresAt",
    s."createdAt"
FROM "Session" s
LEFT JOIN "User" u ON u.id = s."userId"
WHERE u.id IS NULL;

-- Check recent user activity
SELECT 
    u.email,
    u."lastLoginAt",
    COUNT(s.id) as session_count,
    MAX(s."createdAt") as last_session_created
FROM "User" u
LEFT JOIN "Session" s ON s."userId" = u.id
GROUP BY u.id, u.email, u."lastLoginAt"
ORDER BY u."lastLoginAt" DESC NULLS LAST
LIMIT 10;

-- Check if there are any processing sessions or jobs
SELECT 
    'ProcessingSession' as table_name,
    COUNT(*) as record_count
FROM "ProcessingSession"
UNION ALL
SELECT 
    'Job' as table_name,
    COUNT(*) as record_count
FROM "Job"
UNION ALL
SELECT 
    'Transaction' as table_name,
    COUNT(*) as record_count
FROM "Transaction"
UNION ALL
SELECT 
    'AuditLog' as table_name,
    COUNT(*) as record_count
FROM "AuditLog";