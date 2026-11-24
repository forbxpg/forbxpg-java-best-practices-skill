# REST API contract review

## Semantics
- [ ] Methods match meaning: GET safe and idempotent, PUT idempotent, POST creates or
      triggers, DELETE removes; no state change on GET.
- [ ] Status codes: `200` / `201` + `Location` / `204`; `400` validation, `404` not found,
      `409` conflict or version mismatch, `422` only if the project already uses it.
- [ ] Errors are `ProblemDetail` with stable `type` / `title` for each error kind.

## Resources
- [ ] Plural nouns, no verbs (`POST /orders/{id}/cancellation`, not `/cancelOrder`).
- [ ] Ids in the path, filters in query parameters, payload in the body.
- [ ] Lists paginated with a stable sort and a capped page size.

## Payloads
- [ ] Request and response DTOs are records; no entities; no internal fields (version
      excepted when the API uses optimistic locking).
- [ ] Field names consistent (camelCase), dates ISO-8601 with offset, money as string or
      decimal with currency, enums as names.
- [ ] Nullable vs absent fields decided and documented.

## Compatibility
- [ ] No breaking change to a published endpoint without a new version: removing or
      renaming a field, making an optional field required, changing a type or a status
      code, changing error `type`s.
- [ ] Additive changes only (new optional fields, new endpoints) within a version.
- [ ] Clients generated from the OpenAPI contract: the contract file is updated in the
      same change.

## Robustness
- [ ] Idempotency key or natural key for POSTs that clients may retry.
- [ ] Unknown fields in requests ignored (or rejected consistently across the API).
- [ ] Timeouts and payload size limits configured.
