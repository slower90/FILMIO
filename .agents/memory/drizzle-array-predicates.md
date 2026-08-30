---
name: Drizzle array predicates
description: Use Drizzle's inArray helper for JavaScript arrays in PostgreSQL filters
---

Use `inArray(column, values)` for dynamic PostgreSQL membership filters instead of interpolating a JavaScript array into `ANY(${values})`.

**Why:** Drizzle can bind an interpolated array as a tuple expression, producing invalid SQL such as `ANY(($1, $2))` rather than a PostgreSQL array parameter.

**How to apply:** When a route filters by a runtime list of IDs, use `inArray`; reserve raw SQL interpolation for scalar values or explicitly constructed SQL arrays.