-- Exchange rates change over time, so the rates in use are kept as a dated
-- register: 1 base_currency = rate quote_currency from effective_date on.
-- Payment and remittance forms suggest the rate in effect on the
-- transaction date; each transaction still stores the rate it actually used,
-- so later changes to the register never alter past records.
CREATE TABLE exchange_rates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate DECIMAL(24,10) NOT NULL,
  effective_date DATE NOT NULL,
  source VARCHAR(150) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exchange_rates_pair_date (base_currency, quote_currency, effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rates can now be entered either way round (1 USD = 15.23 GHS, or
-- 1 GHS = 0.0657 USD) and are stored in the direction the ledger needs, so
-- the inverse needs more decimal places than six to stay exact.
ALTER TABLE payments
  MODIFY conversion_rate DECIMAL(24,10) NOT NULL DEFAULT 1,
  MODIFY project_rate DECIMAL(24,10) NULL;
ALTER TABLE remittances MODIFY exchange_rate DECIMAL(24,10) NOT NULL DEFAULT 1;
