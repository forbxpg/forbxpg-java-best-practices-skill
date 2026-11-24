// Texts the hooks put in front of the model: a per-prompt anchor and a block after compaction.
import { passportLine, mockBeanName, migrationName } from './passport.mjs';
import { RULES } from './rules.mjs';
import { ROLE_SHORT } from './roles.mjs';

const compile = (p) => (p.wrapper ? './mvnw -q compile' : 'mvn -q compile');

export const defaultAnchorRules = (p) => ['load java-conventions before new classes', 'no @Data on @Entity', `run ${compile(p)} before saying done`];

/** Three rule lines: this session's broken rules (newest first), then touched roles, then the defaults; no repeats. */
export function pickAnchorRules(p, violated = [], roles = []) {
  const candidates = [
    ...violated.map((id) => RULES[id]?.short),
    ...roles.map((role) => ROLE_SHORT[role]),
    ...defaultAnchorRules(p),
  ];
  return [...new Set(candidates.filter(Boolean))].slice(0, 3);
}

/** ≤ 60 tokens: passport line + three rules. */
export function anchorText(p, rules = defaultAnchorRules(p)) {
  return `[forbxpg-java] ${passportLine(p)}\nRules: ${rules.join(' · ')}`;
}

/** ≤ 500 tokens: passport, the router's top rules, up to five rules broken in this session, a pointer back to the plan. */
export function recoveryText(p, broken = []) {
  const rules = [
    'Before creating a class, package or module, load the java-conventions skill.',
    'Packages by layer: config, controller, dto, entity, exception, mapper, repository, service.',
    'Services are concrete classes (no *Impl); inject with @RequiredArgsConstructor and private final fields.',
    'DTOs are records named *Dto; *Request / *Response only at the HTTP boundary.',
    'Entities: @Getter @Setter, never @Data; LAZY relations; @Enumerated(EnumType.STRING).',
    p.mapstruct ? 'Mappers: MapStruct with unmappedTargetPolicy = ReportingPolicy.ERROR.' : 'Mapping: static factory methods in the DTO records.',
    'Errors: ProblemDetail from one @RestControllerAdvice.',
    p.liquibase || p.flyway ? `Schema: add a new ${migrationName(p)}; never edit one that reached main.` : 'Schema changes go through migrations, never ddl-auto.',
    `Tests: JUnit 5 + AssertJ, slices on H2, ${mockBeanName(p)}; never @Disabled a failing test.`,
    `One class per step; run ${compile(p)} after each step; claim "done" only with build output (java-verification).`,
  ];
  const brokenLines = broken.filter((id) => RULES[id]).slice(0, 5).map((id) => `- ${id}: ${RULES[id].short}. Fix: ${RULES[id].fix}.`);
  return [
    '[forbxpg-java] The conversation was compacted. Re-anchor:',
    `Project: ${passportLine(p)}`,
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    ...(brokenLines.length > 0 ? ['Rules you broke in this session:', ...brokenLines] : []),
    'Re-read your plan and grillspec notes before the next step.',
  ].join('\n');
}
