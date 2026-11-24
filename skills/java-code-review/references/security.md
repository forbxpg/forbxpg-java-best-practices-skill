# Security review

## Injection
- [ ] SQL / JPQL with bound parameters only; no string concatenation of user input,
      including `ORDER BY` columns (whitelist them).
- [ ] No user input in shell commands, file paths (`../` traversal), LDAP or XPath.
- [ ] XML parsers with external entities disabled (XXE).

## Input
- [ ] Every request DTO validated; sizes and list lengths bounded; page size capped.
- [ ] File uploads: size limit, content type checked, stored outside the web root with a
      generated name.

## Authentication and authorisation
- [ ] Every endpoint has an access rule; new endpoints are not public by accident.
- [ ] Object-level checks: the caller may access *this* order, not only *orders*.
- [ ] No security decisions on client-supplied roles or ids without verification.

## Secrets and data
- [ ] No secrets, tokens, passwords, internal hosts or real client data in code, tests,
      logs, exceptions or responses.
- [ ] Logs carry ids, not personal data; request bodies are not logged wholesale.
- [ ] Error responses do not leak stack traces or exception messages (5xx says "Internal
      error").
- [ ] Sensitive fields excluded from `toString` (records print all components — override
      `toString` or keep such data out of records that get logged).

## Dependencies and configuration
- [ ] New dependencies come from the approved repository, are maintained, and have no
      known critical vulnerabilities.
- [ ] Actuator: only `health` and `info` exposed publicly; `env`, `heapdump`,
      `configprops` never.
- [ ] CORS restricted to known origins; CSRF reasoning documented for cookie sessions.
- [ ] Cryptography from the platform or a vetted library; no custom crypto, no MD5 / SHA-1
      for passwords (use the password encoder).

Severity: anything that exposes data or bypasses access control is **critical**.
