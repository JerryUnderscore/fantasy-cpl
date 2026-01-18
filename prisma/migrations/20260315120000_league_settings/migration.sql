-- CreateEnum
CREATE TYPE "JoinMode" AS ENUM ('OPEN', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "DraftMode" AS ENUM ('ASYNC', 'TIMED');

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "joinMode" "JoinMode" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "maxTeams" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "draftMode" "DraftMode" NOT NULL DEFAULT 'ASYNC',
ADD COLUMN     "draftPickSeconds" INTEGER,
ADD COLUMN     "rosterSize" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "keepersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keeperCount" INTEGER;
