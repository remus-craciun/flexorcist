-- Training days moved to the generate screen, which keeps the choice on the
-- device. The profile no longer asks for them, so the column is dead weight.
ALTER TABLE `profiles` DROP COLUMN `training_days`;
