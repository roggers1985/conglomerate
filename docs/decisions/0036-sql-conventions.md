# 36. SQL conventions

Date: 2026-09-29

## Status

Accepted

## Context

The owner wants database schemas that are as strict as possible:
- aggressive `NOT NULL`;
- foreign keys, indexes and `CHECK` constraints;
- enum types, default timestamps, and SQLite `STRICT` tables.

The projects use PostgreSQL and SQLite; the jobs project uses SQLite through Drizzle.

## Decision

A `code-sql` skill, loaded for schema, migration and query work, covering both databases:

- **Schemas:**
  - `NOT NULL` by default, with a nullable column only where `NULL` means "deliberately no value", documented;
  - surrogate primary keys, `UNIQUE` natural keys, and foreign keys with an explicit `ON DELETE`;
  - `CHECK` constraints for bounds on both sides (ADR 0032, 0034), relations between columns, and simple formats;
  - `created_at` and `updated_at` defaulting to the current time, stored in UTC;
  - money in integer minor units or `numeric`, never floats;
  - SQLite tables are `STRICT`, and every connection enables `foreign_keys`, WAL and a `busy_timeout`.
- **Enums, with a correction to "use enum types":**
  - native PostgreSQL enums only for sets that practically never change, because values can't be removed or renamed without rebuilding the type;
  - evolving sets use a `CHECK … IN (…)` or a lookup table;
  - SQLite has no enums, so it always uses `CHECK`.
- **Indexes:** every foreign key column (PostgreSQL doesn't index them automatically), then what the queries filter, join and sort on, checked with `EXPLAIN`.
- **Migrations:**
  - versioned, and never edited once applied;
  - expand, migrate, contract for changes to live tables;
  - production migrations always need a human.
- **Queries:**
  - always parameterized, with explicit columns;
  - every query that can return many rows has a `LIMIT`, and pagination uses a key instead of `OFFSET`;
  - no N+1 queries, short transactions, and `ON CONFLICT` upserts.
- **Tests** run against a real database of the same kind, including tests that invalid data is refused.

## Consequences

- Invalid data is refused by the database itself, whatever path it takes.
- Schemas take more thought up front; changing a constraint later needs a migration.
