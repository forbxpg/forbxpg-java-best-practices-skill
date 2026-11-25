// Test utilities: temporary projects and fixture loading.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

// No background release check from hooks run by the tests (it would reach the real remote of this clone).
process.env.FORBXPG_JAVA_UPDATE_CHECK = '0';

export function fixtureInput(name) {
  return JSON.parse(readFileSync(join(FIXTURES, 'inputs', `${name}.json`), 'utf8'));
}

/** Creates a temporary directory with the given files ({ relativePath: content }). */
export function tempProject(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fj-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

export const BOOT4_POM = `<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.1.1</version>
  </parent>
  <properties><maven.compiler.release>21</maven.compiler.release></properties>
  <dependencies>
    <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId></dependency>
    <dependency><groupId>org.mapstruct</groupId><artifactId>mapstruct</artifactId></dependency>
    <dependency><groupId>org.projectlombok</groupId><artifactId>lombok-mapstruct-binding</artifactId></dependency>
    <dependency><groupId>org.liquibase</groupId><artifactId>liquibase-core</artifactId></dependency>
  </dependencies>
</project>
`;

let counter = 0;
export function uniqueSession(prefix = 's') {
  counter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${counter}`;
}
