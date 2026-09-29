---
name: code-sql
description: "The owner's SQL and database conventions for PostgreSQL and SQLite. Covers strict schemas (NOT NULL by default, foreign keys, CHECK constraints for bounds and allowed values, enums, default timestamps, SQLite STRICT tables), indexes, migrations and safe, bounded queries. Use when designing or changing a database schema, writing migrations, writing or reviewing SQL or ORM queries, or choosing column types."
---

# SQL conventions

The database is the last line of defence for data. Every rule that can live in the schema lives there, so bad data is refused however it arrives: a bug, a script, or a manual fix.

## Schemas

### NOT NULL by default

- **Every column is `NOT NULL`**, unless "deliberately no value" has a meaning. Then it's nullable with a comment saying what `NULL` means (matching the optionality rules in `core.md`: `null` means "deliberately no value").
- Never make a column nullable to "fill it in later". Add it with a default, or backfill it in the same migration.
- Collections live in their own table, not in a nullable array or JSON column.

### Keys and relations

- **Primary keys:** a surrogate key on every table. In PostgreSQL, `bigint GENERATED ALWAYS AS IDENTITY`, or a UUIDv7 when ids are created outside the database or exposed publicly. In SQLite, `INTEGER PRIMARY KEY`.
- **Natural keys** (an email address, a slug, an external id) get a `UNIQUE` constraint, composite where uniqueness is per parent (`UNIQUE (company_id, slug)`).
- **Every relation is a foreign key**, with `ON DELETE` chosen explicitly: `RESTRICT` by default, `CASCADE` only for rows that can't exist without their parent, `SET NULL` only for nullable references that mean "no longer linked".
- **SQLite checks foreign keys only after `PRAGMA foreign_keys = ON`**, and it has to be set on every connection. Set it where connections are opened, and test that it's on.

### CHECK constraints

Every rule about a single row that the database can check, it checks:

- **Bounds on both sides** (see `code-safety`): `CHECK (length(title) BETWEEN 1 AND 200)`, `CHECK (quantity >= 0)`, `CHECK (rating BETWEEN 1 AND 5)`.
- **Relations between columns:** `CHECK (ends_at > starts_at)`, `CHECK (discount_cents <= price_cents)`.
- **Formats** where they're simple: `CHECK (currency ~ '^[A-Z]{3}$')` (PostgreSQL) or `CHECK (length(currency) = 3 AND currency = upper(currency))` (SQLite).
- Name constraints (`CONSTRAINT job_title_length CHECK (…)`), so errors say which rule was broken.

### Allowed values (enums)

| Situation | Use |
|---|---|
| A small set that will practically never change (e.g. `draft`, `published`) | PostgreSQL: a native `ENUM` type. SQLite: `CHECK (status IN ('draft', 'published'))` |
| A set that grows or changes | `CHECK (… IN (…))`, changed in a migration, or a lookup table with a foreign key |
| Values with extra data (a label, an order, a flag) | A lookup table |

PostgreSQL enums can gain values but can't lose or rename them without rebuilding the type, so choose them only for truly stable sets.

### Timestamps

- **Every table** has `created_at` and `updated_at`, `NOT NULL`, defaulting to the current time.
- **PostgreSQL:** `timestamptz NOT NULL DEFAULT now()`. Always `timestamptz`, never `timestamp` without a time zone.
- **SQLite:** store milliseconds since the epoch as `INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000)`, or ISO 8601 text in UTC. Pick one per project, and never mix them.
- **`updated_at`** is kept current by a trigger (or consistently by the data layer, never by hand in individual queries).
- Everything is stored in UTC. Time zones are applied only when displaying.

### Types

- **Money:** integer minor units (`price_cents bigint`) or `numeric(12, 2)`. Never floating point.
- **Text:** `text`, with a length `CHECK`, rather than `varchar(n)`, so the limit is a named rule that's easy to change.
- **Booleans:** `boolean` in PostgreSQL; in SQLite, `INTEGER NOT NULL CHECK (x IN (0, 1))`.
- **JSON** only for data that is genuinely unstructured to the application. Anything that is queried, filtered or related belongs in columns.

### SQLite specifics

- **`STRICT` tables** (`CREATE TABLE … (…) STRICT;`), so a column only accepts its declared type.
- **Per connection:** `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL` for concurrent reads, and a `busy_timeout` (a bound on waiting, see `code-safety`).
- `WITHOUT ROWID` only for tables with a natural, non-integer primary key that are read by that key.

### Naming

- `snake_case` for tables, columns and constraints; plural table names (`jobs`), and foreign keys named after the table they point to, in singular (`company_id`).
- Units last in column names: `duration_ms`, `price_cents`, `size_bytes`.

## Indexes

- **Every foreign key column is indexed.** PostgreSQL doesn't do this automatically, and unindexed foreign keys make joins and deletes slow.
- **Index what is filtered, joined and sorted,** based on the actual queries. Composite indexes follow the query: equality columns first, then range or sort columns.
- **Partial indexes** for queries on a subset (`WHERE status = 'published'`), and unique partial indexes for rules like "one active subscription per user".
- Check new or changed queries with `EXPLAIN` (`EXPLAIN QUERY PLAN` in SQLite) before merging.
- Don't add indexes without a query that needs them: every index slows down writes.

## Migrations

- **Versioned, in the repository,** applied by the project's migration tool, one purpose per migration.
- **Forward-only once applied:** never edit a migration that has run anywhere shared. Fix it with a new one.
- **Changes to live tables** use expand, then migrate, then contract: add the new column or table, move the data and the code, and only then drop the old one, in a later migration.
- **Adding a `NOT NULL` column** to a table with data gives it a default, or backfills it in the same migration.
- **Data migrations** are separate from schema migrations, and bounded (in batches).
- Production migrations are always a "Needs a human" step for checkups and agents (see the checkup protocol).

## Queries

- **Always parameterized.** Never build SQL from strings containing input.
- **Explicit columns,** never `SELECT *` in application code.
- **Every query that can return many rows has a `LIMIT`** (see `code-safety`). Paginate with a key (`WHERE id > $1 ORDER BY id LIMIT $2`) rather than `OFFSET`, which gets slower and can skip rows.
- **No N+1 queries:** load related rows with a join or one `IN (…)` query, not one query per row.
- **Several writes that belong together** go in one transaction, and are kept short.
- **Upserts** use `INSERT … ON CONFLICT … DO UPDATE`, not "select, then insert or update".
- **Rows read from the database are parsed at the boundary** like any external data (see `code-parsing`), unless the query layer generates types from the schema.

## ORMs and query builders

Follow the project's choice (e.g. Drizzle). Declare the same constraints there as in raw SQL: not null, foreign keys, checks, indexes and defaults. An ORM that can't express a constraint gets it in a raw SQL migration, not left out.

## Tests

- **Schema and migrations are tested against a real database** of the same kind (a temporary SQLite file, or a PostgreSQL test container), never mocked.
- **Test the constraints:** inserting invalid data (a `NULL`, a value just past a `CHECK` bound, a dangling foreign key) is refused.
- **Every migration** runs from an empty database and, where it matters, from a copy with representative data.
