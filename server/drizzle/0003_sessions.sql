CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_id` integer,
	`program_id` integer,
	`week` integer NOT NULL,
	`day_index` integer NOT NULL,
	`location` text NOT NULL,
	`label` text,
	`program_title` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`duration_ms` integer NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sessions_started_at_idx` ON `sessions` (`started_at`);
