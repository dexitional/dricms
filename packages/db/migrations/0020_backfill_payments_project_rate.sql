-- Fill project_rate where it follows from what was recorded: 1 when the
-- tranche is in the project's currency, the claim conversion rate when the
-- claim is.
UPDATE payments pm
  JOIN claims cl ON cl.id = pm.claim_id
  JOIN phases ph ON ph.id = cl.phase_id
  JOIN projects p ON p.id = ph.project_id
   SET pm.project_rate = CASE
         WHEN pm.currency = p.currency THEN 1
         WHEN cl.currency = p.currency THEN pm.conversion_rate
       END
 WHERE pm.project_rate IS NULL;
