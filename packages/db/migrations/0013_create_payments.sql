-- Tranche payments against a claim. converted = amount * conversion_rate, in
-- the claim's currency.
CREATE TABLE payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference CHAR(5) NOT NULL,
  claim_id INT UNSIGNED NOT NULL,
  description VARCHAR(500) NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  conversion_rate DECIMAL(18,6) NOT NULL DEFAULT 1,
  paid_at DATE NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_reference (reference),
  KEY idx_payments_claim (claim_id),
  KEY idx_payments_paid_at (paid_at),
  CONSTRAINT fk_payments_claim FOREIGN KEY (claim_id) REFERENCES claims (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
