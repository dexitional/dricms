-- Retirement of a tranche: how the money was spent, line by line against the
-- phase's activities, each line with its receipts. Amounts are in the
-- tranche's currency. Only ACCEPTED lines count as retired; REJECTED lines
-- don't count towards the tranche at all.
CREATE TABLE retirements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id INT UNSIGNED NOT NULL,
  activity_id INT UNSIGNED NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  spent_at DATE NOT NULL,
  receipts JSON NOT NULL,
  status ENUM('SUBMITTED','ACCEPTED','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
  review_note VARCHAR(500) NULL,
  reviewed_by INT UNSIGNED NULL,
  reviewed_at TIMESTAMP NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_retirements_payment (payment_id, status),
  KEY idx_retirements_activity (activity_id),
  CONSTRAINT fk_retirements_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_retirements_activity FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
