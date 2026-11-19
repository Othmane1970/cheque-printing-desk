CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`bank_name` text NOT NULL,
	`account_name` text NOT NULL,
	`account_number` text NOT NULL,
	`currency` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `accounts_company` ON `accounts` (`company_id`);--> statement-breakpoint
CREATE TABLE `cheque_books` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`first_serial` integer NOT NULL,
	`last_serial` integer NOT NULL,
	`next_serial` integer NOT NULL,
	`low_threshold` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cheque_books_account` ON `cheque_books` (`account_id`);--> statement-breakpoint
CREATE TABLE `cheques` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`account_id` text NOT NULL,
	`book_id` text NOT NULL,
	`template_id` text,
	`created_by` text NOT NULL,
	`serial` integer NOT NULL,
	`payee` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`cheque_date` text NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`crossed` integer DEFAULT false NOT NULL,
	`language` text NOT NULL,
	`amount_words` text NOT NULL,
	`status` text DEFAULT 'printed' NOT NULL,
	`status_changed_at` text DEFAULT (current_timestamp) NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`book_id`) REFERENCES `cheque_books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cheques_book_serial` ON `cheques` (`book_id`,`serial`);--> statement-breakpoint
CREATE INDEX `cheques_company_date` ON `cheques` (`company_id`,`cheque_date`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`trade_number` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `companies_org_owner` ON `companies` (`org_id`,`owner_id`);--> statement-breakpoint
CREATE TABLE `template_offsets` (
	`user_id` text NOT NULL,
	`template_id` text NOT NULL,
	`offset_x_mm` real DEFAULT 0 NOT NULL,
	`offset_y_mm` real DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `template_id`),
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`owner_id` text,
	`built_in` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`bank_name` text NOT NULL,
	`currency` text NOT NULL,
	`width_mm` real NOT NULL,
	`height_mm` real NOT NULL,
	`layout` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`org_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
