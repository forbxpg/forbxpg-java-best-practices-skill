// Project passport: what the build says about the stack, read from pom.xml files with regexes.
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectCacheDir } from './state.mjs';

const WEB = [
  ['webmvc', /<artifactId>spring-boot-starter-web(mvc)?<\/artifactId>/],
  ['webflux', /<artifactId>spring-boot-starter-webflux<\/artifactId>/],
  ['feign', /<artifactId>spring-cloud-starter-openfeign<\/artifactId>/],
];
const QUALITY = [
  ['checkstyle', /maven-checkstyle-plugin/],
  ['spotbugs', /spotbugs-maven-plugin/],
  ['spotless', /spotless-maven-plugin/],
  ['errorprone', /error_prone_core/],
  ['archunit', /<groupId>com\.tngtech\.archunit<\/groupId>/],
  ['jacoco', /jacoco-maven-plugin/],
  ['enforcer', /maven-enforcer-plugin/],
];

const stripComments = (xml) => xml.replace(/<!--[\s\S]*?-->/g, '');
const tag = (xml, name) => xml.match(new RegExp(`<${name}>\\s*([^<]+?)\\s*</${name}>`))?.[1] ?? null;

function readPom(path) {
  try {
    return stripComments(readFileSync(path, 'utf8'));
  } catch {
    return '';
  }
}

/** Root pom plus module poms, recursively. */
function collectPoms(dir, seen = new Set()) {
  if (seen.has(dir)) return [];
  seen.add(dir);
  const xml = readPom(join(dir, 'pom.xml'));
  const modules = [...(xml.match(/<modules>([\s\S]*?)<\/modules>/)?.[1] ?? '').matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)].map((m) => m[1]);
  return [{ dir, xml, modules }, ...modules.flatMap((m) => collectPoms(join(dir, m), seen))];
}

function resolve(value, xml) {
  if (!value) return null;
  return value.replace(/\$\{([^}]+)\}/g, (all, prop) => tag(xml, prop.replace(/\./g, '\\.')) ?? all);
}

function bootVersion(xml) {
  const parent = xml.match(/<parent>([\s\S]*?)<\/parent>/)?.[1] ?? '';
  if (/<artifactId>spring-boot-starter-parent<\/artifactId>/.test(parent)) return resolve(tag(parent, 'version'), xml);
  const bom = xml.match(/<dependency>((?:(?!<\/dependency>)[\s\S])*?<artifactId>spring-boot-dependencies<\/artifactId>[\s\S]*?)<\/dependency>/)?.[1];
  return bom ? resolve(tag(bom, 'version'), xml) : null;
}

/**
 * Boot version behind a corporate parent or an aggregator root: a version property, a BOM in any
 * pom, or the spring-boot-maven-plugin version — the first that names a concrete version.
 */
function fallbackBootVersion(poms) {
  for (const { xml } of poms) {
    for (const name of ['spring-boot\\.version', 'spring\\.boot\\.version', 'springboot\\.version']) {
      const value = resolve(tag(xml, name), xml);
      if (value && !value.includes('${')) return value;
    }
  }
  for (const { xml } of poms) {
    const value = bootVersion(xml);
    if (value && !value.includes('${')) return value;
  }
  for (const { xml } of poms) {
    const plugin = xml.match(/<plugin>((?:(?!<\/plugin>)[\s\S])*?<artifactId>spring-boot-maven-plugin<\/artifactId>[\s\S]*?)<\/plugin>/)?.[1];
    const value = plugin ? resolve(tag(plugin, 'version'), xml) : null;
    if (value && !value.includes('${')) return value;
  }
  return null;
}

function javaVersion(xml) {
  for (const name of ['maven\\.compiler\\.release', 'java\\.version', 'maven\\.compiler\\.source', 'maven\\.compiler\\.target', 'release']) {
    const value = resolve(tag(xml, name), xml);
    if (value && !value.includes('${')) return value.replace(/^1\./, '');
  }
  return null;
}

function framework(all, boot) {
  if (/io\.quarkus/.test(all)) return 'quarkus';
  if (boot || /org\.springframework/.test(all)) return 'spring';
  if (/<artifactId>jakarta\.jakartaee-(api|web-api)<\/artifactId>/.test(all)) return 'jakarta';
  return 'plain';
}

function build(dir) {
  const poms = collectPoms(dir);
  const root = poms[0].xml;
  const all = poms.map((p) => p.xml).join('\n');
  const fromRoot = bootVersion(root);
  const boot = fromRoot && !fromRoot.includes('${') ? fromRoot : fallbackBootVersion(poms);
  return {
    build: 'maven',
    wrapper: existsSync(join(dir, 'mvnw')) || existsSync(join(dir, 'mvnw.cmd')),
    java: javaVersion(root) ?? poms.slice(1).map((p) => javaVersion(p.xml)).find(Boolean) ?? null,
    boot,
    lombok: /<artifactId>lombok<\/artifactId>/.test(all),
    mapstruct: /<artifactId>mapstruct<\/artifactId>/.test(all),
    mapstructBinding: /<artifactId>lombok-mapstruct-binding<\/artifactId>/.test(all),
    liquibase: /<artifactId>liquibase-(core|maven-plugin)<\/artifactId>/.test(all),
    flyway: /<artifactId>flyway-[\w-]+<\/artifactId>/.test(all),
    h2: /<artifactId>h2<\/artifactId>/.test(all),
    testcontainers: /<groupId>org\.testcontainers<\/groupId>/.test(all),
    web: WEB.filter(([, re]) => re.test(all)).map(([name]) => name),
    quality: QUALITY.filter(([, re]) => re.test(all)).map(([name]) => name),
    modules: poms[0].modules,
    docker: process.platform === 'win32' ? existsSync('\\\\.\\pipe\\docker_engine') : existsSync('/var/run/docker.sock'),
    framework: framework(all, boot),
  };
}

/** Passport of the Maven project in `projectDir`, cached by the root pom.xml mtime (ms) and size. */
export function readPassport(projectDir) {
  const stat = statSync(join(projectDir, 'pom.xml'));
  const stamp = `${Math.floor(stat.mtimeMs)}:${stat.size}`;
  const cacheDir = projectCacheDir(projectDir);
  const cacheFile = join(cacheDir, 'passport.json');
  try {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf8'));
    if (cached.stamp === stamp) return cached.passport;
  } catch {
    // No cache yet.
  }
  const passport = build(projectDir);
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify({ stamp, passport }));
  } catch {
    // Cache is an optimisation only.
  }
  return passport;
}

export function bootMajor(passport) {
  const major = Number.parseInt(passport?.boot ?? '', 10);
  return Number.isNaN(major) ? null : major;
}

/** One line for the anchor and SessionStart, e.g. "Maven · Java 21 · Boot 4.1 · Lombok". */
export function passportLine(p) {
  const parts = ['Maven'];
  if (p.java) parts.push(`Java ${p.java}`);
  if (p.framework === 'quarkus') return [...parts, 'Quarkus: no specific rules'].join(' · ');
  if (p.framework === 'jakarta') return [...parts, 'Jakarta EE: no specific rules'].join(' · ');
  if (p.boot) parts.push(`Boot ${p.boot.split('.').slice(0, 2).join('.')}`);
  if (p.lombok) parts.push('Lombok');
  if (p.mapstruct) parts.push('MapStruct');
  if (p.liquibase) parts.push('Liquibase');
  if (p.flyway) parts.push('Flyway');
  return parts.join(' · ');
}
