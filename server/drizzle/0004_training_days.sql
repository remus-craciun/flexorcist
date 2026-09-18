-- Profiles record which weekdays the athlete trains, not how many days.
-- Existing rows are spread over the week so a 3-day athlete lands on
-- Mon/Wed/Fri rather than Mon/Tue/Wed.
ALTER TABLE `profiles` ADD `training_days` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `profiles` SET `training_days` = CASE `days_per_week`
	WHEN 1 THEN '[3]'
	WHEN 2 THEN '[2,5]'
	WHEN 3 THEN '[1,3,5]'
	WHEN 4 THEN '[1,2,4,5]'
	WHEN 5 THEN '[1,2,3,4,5]'
	WHEN 6 THEN '[1,2,3,4,5,6]'
	WHEN 7 THEN '[1,2,3,4,5,6,7]'
	ELSE '[]'
END;--> statement-breakpoint
ALTER TABLE `profiles` DROP COLUMN `days_per_week`;
