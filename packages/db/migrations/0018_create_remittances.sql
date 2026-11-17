-- Funds a funder distributes to a project. exchange_rate turns the remittance
-- into the project's currency (amount * exchange_rate), which is the currency
-- the project's balance sheet is kept in (apps/web/src/server/api/lib/ledger.ts).
CREATE TABLE remittances (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference VARCHAR(20) NOT NULL,
  project_id INT UNSIGNED NOT NULL,
  funder_id INT UNSIGNED NULL,
  description VARCHAR(500) NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1,
  received_at DATE NOT NULL,
  attachments JSON NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_remittances_reference (reference),
  KEY idx_remittances_project (project_id, received_at),
  KEY idx_remittances_funder (funder_id),
  CONSTRAINT fk_remittances_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT,
  CONSTRAINT fk_remittances_funder FOREIGN KEY (funder_id) REFERENCES funders (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
