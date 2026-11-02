CREATE TABLE funders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  location VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(40) NULL,
  email VARCHAR(150) NULL,
  country_id SMALLINT UNSIGNED NULL,
  website_url VARCHAR(255) NULL,
  logo_url VARCHAR(500) NULL,
  portal_url VARCHAR(255) NULL,
  portal_username VARCHAR(150) NULL,
  -- AES-256-GCM ciphertext (see apps/web/src/server/api/lib/secrets.ts); never plain text.
  portal_password_enc VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_funders_name (name),
  CONSTRAINT fk_funders_country FOREIGN KEY (country_id) REFERENCES countries (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
