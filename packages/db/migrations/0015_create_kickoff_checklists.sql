-- One kick-off meeting checklist per project. `items` holds the twelve
-- checklist entries as [{ "no": 1, "tick": true|false|null, "note": "" }].
CREATE TABLE kickoff_checklists (
  project_id INT UNSIGNED NOT NULL,
  meeting_date DATE NULL,
  venue VARCHAR(200) NULL,
  attendees TEXT NULL,
  items JSON NOT NULL,
  notes TEXT NULL,
  updated_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (project_id),
  CONSTRAINT fk_kickoff_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
