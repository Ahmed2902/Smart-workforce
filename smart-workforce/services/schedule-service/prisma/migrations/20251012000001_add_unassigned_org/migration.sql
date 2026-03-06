-- Ensure a stable fallback organization exists for cross-service sync events
INSERT INTO "schedule"."CachedOrganization" ("id", "name")
VALUES ('unassigned', 'Unassigned')
ON CONFLICT ("id") DO NOTHING;
