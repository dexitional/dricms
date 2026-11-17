-- Supporting documents (invoices, quotations, pro-formas…) uploaded with a
-- claim, as [{url, name, size, type}] like requests.attachments.
ALTER TABLE claims ADD COLUMN attachments JSON NULL AFTER reasons;
