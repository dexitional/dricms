CREATE TABLE project_co_investigators (
  project_id INT UNSIGNED NOT NULL,
  investigator_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (project_id, investigator_id),
  KEY idx_pci_investigator (investigator_id),
  CONSTRAINT fk_pci_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
  CONSTRAINT fk_pci_investigator FOREIGN KEY (investigator_id) REFERENCES investigators (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
