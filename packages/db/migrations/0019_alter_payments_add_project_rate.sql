-- Rate from the tranche currency into the project's currency, so each tranche
-- can be charged against the project's balance sheet (amount * project_rate).
-- NULL only on older tranches whose rate can't be inferred (0020).
ALTER TABLE payments ADD COLUMN project_rate DECIMAL(18,6) NULL AFTER conversion_rate;
