-- 02-data-model.md sections 3 and 6. STRICT tables; the SQL is the source of truth for constraints (ADR 0003).

CREATE TABLE fx_rates (
  currency_code       TEXT    PRIMARY KEY CHECK (length(currency_code) = 3 AND currency_code = upper(currency_code)),
  usd_per_unit_micros INTEGER NOT NULL CHECK (usd_per_unit_micros > 0),
  as_of_date          TEXT    NOT NULL CHECK (date(as_of_date) IS as_of_date)
) STRICT;

CREATE TABLE countries (
  code          TEXT PRIMARY KEY CHECK (length(code) = 2 AND code = upper(code)),  -- ISO 3166-1 alpha-2
  name          TEXT NOT NULL UNIQUE,
  currency_code TEXT NOT NULL REFERENCES fx_rates(currency_code)
) STRICT;

CREATE TABLE departments (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
) STRICT;

CREATE TABLE job_titles (
  id            INTEGER PRIMARY KEY,
  name          TEXT    NOT NULL UNIQUE,
  department_id INTEGER NOT NULL REFERENCES departments(id)
) STRICT;

CREATE TABLE levels (
  code TEXT    PRIMARY KEY CHECK (code IN ('L1','L2','L3','L4','L5')),
  name TEXT    NOT NULL UNIQUE,
  rank INTEGER NOT NULL UNIQUE
) STRICT;

CREATE TABLE pay_bands (
  country_code  TEXT    NOT NULL REFERENCES countries(code),
  job_title_id  INTEGER NOT NULL REFERENCES job_titles(id),
  level_code    TEXT    NOT NULL REFERENCES levels(code),
  currency_code TEXT    NOT NULL REFERENCES fx_rates(currency_code),
  min_minor     INTEGER NOT NULL CHECK (min_minor > 0),
  mid_minor     INTEGER NOT NULL,
  max_minor     INTEGER NOT NULL,
  PRIMARY KEY (country_code, job_title_id, level_code),
  CHECK (min_minor < mid_minor AND mid_minor < max_minor)
) STRICT;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name  TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('hr_admin','hr_viewer','finance')),
  password_hash TEXT    NOT NULL,          -- scrypt$N$r$p$<salt>$<hash> (ADR 0006)
  created_at    TEXT    NOT NULL
) STRICT;

CREATE TABLE employees (
  id                    INTEGER PRIMARY KEY,
  employee_code         TEXT    NOT NULL UNIQUE CHECK (employee_code GLOB 'E[0-9][0-9][0-9][0-9][0-9][0-9]'),
  first_name            TEXT    NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 100),
  last_name             TEXT    NOT NULL CHECK (length(trim(last_name))  BETWEEN 1 AND 100),
  name_search           TEXT    NOT NULL,  -- normalised "first last", written by the app, see section 5
  gender                TEXT    NOT NULL CHECK (gender IN ('female','male','non_binary','not_disclosed')),
  country_code          TEXT    NOT NULL REFERENCES countries(code),
  job_title_id          INTEGER NOT NULL REFERENCES job_titles(id),
  level_code            TEXT    NOT NULL REFERENCES levels(code),
  hire_date             TEXT    NOT NULL CHECK (date(hire_date) IS hire_date),
  status                TEXT    NOT NULL CHECK (status IN ('active','terminated')),
  termination_date      TEXT    CHECK (termination_date IS NULL OR date(termination_date) IS termination_date),
  salary_minor          INTEGER NOT NULL CHECK (salary_minor > 0),
  salary_currency       TEXT    NOT NULL REFERENCES fx_rates(currency_code),
  salary_effective_date TEXT    NOT NULL CHECK (date(salary_effective_date) IS salary_effective_date),
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL,
  FOREIGN KEY (country_code, job_title_id, level_code)
    REFERENCES pay_bands(country_code, job_title_id, level_code),  -- every employee has a band
  CHECK ((status = 'terminated') = (termination_date IS NOT NULL)),
  CHECK (termination_date IS NULL OR termination_date >= hire_date),
  CHECK (salary_effective_date >= hire_date)
) STRICT;

CREATE TABLE salary_changes (
  id                 INTEGER PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id),
  effective_date     TEXT    NOT NULL CHECK (date(effective_date) IS effective_date),
  amount_minor       INTEGER NOT NULL CHECK (amount_minor > 0),
  currency_code      TEXT    NOT NULL REFERENCES fx_rates(currency_code),
  job_title_id       INTEGER NOT NULL REFERENCES job_titles(id),  -- position in effect from effective_date (D-029)
  level_code         TEXT    NOT NULL REFERENCES levels(code),
  reason             TEXT    NOT NULL CHECK (reason IN ('hire','promotion','merit','market_adjustment','correction')),
  changed_by_user_id INTEGER REFERENCES users(id),  -- NULL means imported by the seed; the UI shows "Imported"
  created_at         TEXT    NOT NULL
) STRICT;

-- Added by Chat 3 (ADR 0006): server-side sessions. The cookie holds a random token; only its SHA-256 is stored.
CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,                    -- hex SHA-256 of the 32-byte random token
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
) STRICT;

-- Added by Chat 3 (ADR 0008): one row per "Ask about pay" request. Serves the daily caps and the audit trail.
CREATE TABLE ask_log (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  asked_at          TEXT    NOT NULL,
  question          TEXT    NOT NULL CHECK (length(question) BETWEEN 1 AND 500),
  outcome           TEXT    NOT NULL CHECK (outcome IN ('answered','cannot_answer','error','rate_limited')),
  interpreted_query TEXT,                            -- JSON of the structured query; NULL unless answered
  input_tokens      INTEGER,
  output_tokens     INTEGER
) STRICT;

-- Indexes I2 to I7 and I12 to I14 (02-data-model.md section 6).
CREATE INDEX ix_employees_status_name ON employees(status, last_name, first_name, id);
CREATE INDEX ix_employees_cohort ON employees(country_code, job_title_id, level_code, status);
CREATE INDEX ix_employees_title_level ON employees(job_title_id, level_code);
CREATE INDEX ix_employees_salary_date ON employees(salary_effective_date);
CREATE INDEX ix_employees_hire_date ON employees(hire_date);
CREATE INDEX ix_salary_changes_employee ON salary_changes(employee_id, effective_date, id);
CREATE INDEX ix_sessions_user ON sessions(user_id);
CREATE INDEX ix_ask_log_user_time ON ask_log(user_id, asked_at);
CREATE INDEX ix_ask_log_time ON ask_log(asked_at);
