-- A profile photo for investigators and personnel, stored through the
-- uploads endpoint (/api/files/...). When it is empty, the app shows the
-- person's UCC staff photo if they have a staff number.
ALTER TABLE investigators ADD COLUMN photo_url VARCHAR(255) NULL AFTER staff_no;
ALTER TABLE personnel ADD COLUMN photo_url VARCHAR(255) NULL AFTER staff_no;
