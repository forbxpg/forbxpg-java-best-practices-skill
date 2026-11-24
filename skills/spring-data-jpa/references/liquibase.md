# Liquibase

Liquibase owns the schema. Hibernate only validates it (`ddl-auto: validate`).

## Layout

```
src/main/resources/db/changelog/
├── db.changelog-master.yaml
└── changes/
    ├── 001-create-orders.xml
    ├── 002-add-order-status.xml
    └── 003-index-orders-customer.xml
```

```yaml
databaseChangeLog:
  - includeAll:
      path: db/changelog/changes/
```

(or one `include` per file when the project lists them explicitly — follow the project).

## Rules

- **Never edit a changeset that reached `main`**: it may have run on a shared database,
  and Liquibase fails on a changed checksum. The hook blocks such edits (G1). Add a new
  file instead.
- One logical change per changeset; each has a unique `id` and an `author`.
- File names: `NNN-<what>.xml`, the next free three-digit number.
- Add a `<rollback>` where Liquibase cannot generate one (data changes, raw SQL).
- Name constraints and indexes explicitly: `pk_orders`, `fk_order_lines_order`,
  `uk_orders_number`, `ix_orders_customer_id`. Index every foreign key column.
- A new `NOT NULL` column on a filled table: add it nullable, backfill, then add the
  constraint — or give it a `defaultValueComputed` / `defaultValue`.
- Data fixes go in their own changeset with a `context` or `labels` when they must not
  run everywhere.
- Every entity change ships with its changeset in the same change.

## Example

```xml
<databaseChangeLog
        xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
        http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-latest.xsd">

    <changeSet id="002-add-order-status" author="orders-team">
        <addColumn tableName="orders">
            <column name="status" type="varchar(16)" defaultValue="NEW">
                <constraints nullable="false"/>
            </column>
        </addColumn>
        <createIndex tableName="orders" indexName="ix_orders_status">
            <column name="status"/>
        </createIndex>
    </changeSet>
</databaseChangeLog>
```

## Testing

- `@DataJpaTest` runs the changelog against H2 when Liquibase is on the classpath; H2
  accepts most DDL but not every PostgreSQL / Greenplum type or function.
- When the project keeps changelogs only in `src/test/resources`, the schema is
  managed elsewhere (a DBA or another service): do not move them to `main` without asking.

## Boot 4

Use `spring-boot-starter-liquibase` (Boot 4 moved Liquibase support into its own module);
on Boot 3 the `liquibase-core` dependency alone is enough.
