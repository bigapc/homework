-- Add courier payout tracking
-- Courier earns 60-70% of job fee (we use 65% as default)

ALTER TABLE exchanges ADD COLUMN courier_payout_cents INTEGER;

-- Update existing completed exchanges with payout calculation
UPDATE exchanges
SET courier_payout_cents = ROUND(quoted_total_cents * 0.65)
WHERE status = 'completed' AND quoted_total_cents IS NOT NULL;

-- Add comment
COMMENT ON COLUMN exchanges.courier_payout_cents IS 'Courier earnings in cents (65% of job fee)';