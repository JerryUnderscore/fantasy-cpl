-- Backfill RosterSlot.position for all slots based on slotNumber (including empty slots)
UPDATE "RosterSlot"
SET "position" = (
  CASE
    WHEN "slotNumber" IN (1, 2) THEN 'GK'
    WHEN "slotNumber" BETWEEN 3 AND 7 THEN 'DEF'
    WHEN "slotNumber" BETWEEN 8 AND 12 THEN 'MID'
    WHEN "slotNumber" BETWEEN 13 AND 15 THEN 'FWD'
    ELSE 'MID'
  END
)::"PlayerPosition";

-- For filled slots, ensure position matches the actual Player.position (already enum-typed)
UPDATE "RosterSlot" AS rs
SET "position" = p."position"
FROM "Player" AS p
WHERE rs."playerId" = p."id";