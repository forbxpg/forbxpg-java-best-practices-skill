import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, utimesSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPassport, passportLine, bootMajor } from '../hooks/lib/passport.mjs';
import { FIXTURES, tempProject } from './helpers.mjs';

const copyFixture = (name) => {
  const dir = tempProject();
  cpSync(join(FIXTURES, 'poms', name), dir, { recursive: true });
  return dir;
};

test('S-PASS-1: Boot 4 project with Lombok, MapStruct, Liquibase', () => {
  const p = readPassport(copyFixture('boot4-lombok-mapstruct-liquibase'));
  assert.equal(passportLine(p), 'Maven · Java 21 · Boot 4.1 · Lombok · MapStruct · Liquibase');
  assert.equal(p.boot, '4.1.1');
  assert.equal(bootMajor(p), 4);
  assert.equal(p.mapstructBinding, true);
  assert.equal(p.h2, true);
  assert.equal(p.framework, 'spring');
  assert.deepEqual(p.web, ['webmvc']);
  assert.deepEqual(p.quality, ['checkstyle', 'jacoco']);
  assert.equal(p.wrapper, false);
});

test('S-PASS-2: Quarkus project is marked as having no specific rules', () => {
  const p = readPassport(copyFixture('quarkus'));
  assert.equal(p.framework, 'quarkus');
  assert.equal(passportLine(p), 'Maven · Java 21 · Quarkus: no specific rules');
});

test('multi-module Boot 3: modules, parent Java version, module dependencies', () => {
  const p = readPassport(copyFixture('boot3-multimodule'));
  assert.deepEqual(p.modules, ['core', 'app']);
  assert.equal(p.java, '17');
  assert.equal(bootMajor(p), 3);
  assert.deepEqual(p.web, ['webmvc', 'feign']);
  assert.equal(p.testcontainers, true);
  assert.equal(p.flyway, true);
  assert.deepEqual(p.quality, ['archunit']);
  assert.equal(passportLine(p), 'Maven · Java 17 · Boot 3.5 · Flyway');
});

test('plain Java project: no Boot, compiler.source fallback', () => {
  const p = readPassport(copyFixture('plain'));
  assert.equal(p.framework, 'plain');
  assert.equal(bootMajor(p), null);
  assert.equal(passportLine(p), 'Maven · Java 25');
});

test('wrapper is detected from mvnw', () => {
  const dir = copyFixture('plain');
  writeFileSync(join(dir, 'mvnw'), '');
  assert.equal(readPassport(dir).wrapper, true);
});

test('passport is cached until pom.xml mtime changes', () => {
  const dir = copyFixture('plain');
  const pom = join(dir, 'pom.xml');
  const atime = new Date(1_700_000_000_000);
  const mtime = new Date(1_700_000_000_000);
  utimesSync(pom, atime, mtime);
  const first = readPassport(dir);
  writeFileSync(pom, readFileSync(pom, 'utf8').replace(/25/g, '21'));
  utimesSync(pom, atime, mtime);
  assert.equal(readPassport(dir).java, first.java, 'same mtime → cached value');
  utimesSync(pom, atime, new Date(mtime.getTime() + 5000));
  assert.equal(readPassport(dir).java, '21', 'new mtime → re-read');
});

const CORP_PARENT = '<parent><groupId>ru.corp</groupId><artifactId>corp-parent</artifactId><version>7</version></parent>';

test('M3: Boot version from a spring-boot.version property behind a corporate parent', () => {
  const dir = tempProject({ 'pom.xml': `<project>${CORP_PARENT}<properties><spring-boot.version>3.5.4</spring-boot.version></properties></project>` });
  assert.equal(readPassport(dir).boot, '3.5.4');
});

test('M3: Boot version from a BOM in a module of an aggregator root', () => {
  const dir = tempProject({
    'pom.xml': `<project>${CORP_PARENT}<packaging>pom</packaging><modules><module>app</module></modules></project>`,
    'app/pom.xml': '<project><dependencyManagement><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-dependencies</artifactId><version>4.0.7</version><type>pom</type><scope>import</scope></dependency></dependencies></dependencyManagement></project>',
  });
  assert.equal(readPassport(dir).boot, '4.0.7');
  assert.equal(bootMajor(readPassport(dir)), 4);
});

test('M3: Boot version from spring-boot-maven-plugin when nothing else names it', () => {
  const dir = tempProject({ 'pom.xml': `<project>${CORP_PARENT}<build><plugins><plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId><version>4.1.1</version></plugin></plugins></build></project>` });
  assert.equal(readPassport(dir).boot, '4.1.1');
});
