CREATE TABLE countries (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code CHAR(2) NOT NULL,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_countries_code (code),
  KEY idx_countries_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
