PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `workouts_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`week` integer NOT NULL,
	`day_index` integer NOT NULL,
	`label` text,
	`location` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `workouts_new` (`id`, `program_id`, `week`, `day_index`, `label`, `location`)
SELECT `w`.`id`, `d`.`program_id`, `d`.`week`, `d`.`day_index`, `d`.`label`, `w`.`location`
FROM `workouts` AS `w`
INNER JOIN `program_days` AS `d` ON `d`.`id` = `w`.`program_day_id`;
--> statement-breakpoint
CREATE TABLE `workout_exercises_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`sets` integer DEFAULT 3 NOT NULL,
	`reps` text DEFAULT '8-12' NOT NULL,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts_new`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `workout_exercises_new`
SELECT `we`.* FROM `workout_exercises` AS `we`
WHERE `we`.`workout_id` IN (SELECT `id` FROM `workouts_new`);
--> statement-breakpoint
DROP TABLE `workout_exercises`;
--> statement-breakpoint
DROP TABLE `workouts`;
--> statement-breakpoint
DROP TABLE `program_days`;
--> statement-breakpoint
ALTER TABLE `workouts_new` RENAME TO `workouts`;
--> statement-breakpoint
ALTER TABLE `workout_exercises_new` RENAME TO `workout_exercises`;
--> statement-breakpoint
CREATE UNIQUE INDEX `workouts_program_week_day_location_idx` ON `workouts` (`program_id`,`week`,`day_index`,`location`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
