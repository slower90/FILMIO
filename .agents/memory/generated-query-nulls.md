---
name: Generated query nulls
description: Pagination and optional query parameters in generated API clients
---

When calling generated query clients, omit optional pagination parameters whose initial value is null instead of passing the null value through.

**Why:** The generated URL serializer in this workspace emits null as the literal query-string value `"null"`, which can fail server-side cursor validation and turn an otherwise valid first-page request into a 400.

**How to apply:** For the first page, pass only the non-null query parameters; include the cursor only for subsequent pages when a real cursor string exists.