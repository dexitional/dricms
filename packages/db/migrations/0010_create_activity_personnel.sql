CREATE TABLE activity_personnel (
  activity_id INT UNSIGNED NOT NULL,
  personnel_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (activity_id, personnel_id),
  KEY idx_ap_personnel (personnel_id),
  CONSTRAINT fk_ap_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE,
  CONSTRAINT fk_ap_personnel FOREIGN KEY (personnel_id) REFERENCES personnel (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
