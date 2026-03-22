ALTER TABLE "schedule"."CachedUser"
ADD COLUMN "authUserId" TEXT;

CREATE UNIQUE INDEX "CachedUser_authUserId_key"
ON "schedule"."CachedUser"("authUserId");
