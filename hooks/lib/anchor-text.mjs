// Texts the hooks put in front of the model: a per-prompt anchor and a block after compaction.
import { passportLine } from './passport.mjs';

const compile = (p) => (p.wrapper ? './mvnw -q compile' : 'mvn -q compile');

/** ≤ 60 tokens: passport line + three rules. */
export function anchorText(p) {
  return `[forbxpg-java] ${passportLine(p)}\nRules: load java-conventions before new classes · no @Data on @Entity · run ${compile(p)} before saying done`;
}

/** ≤ 400 tokens: passport, the router's top rules and a pointer back to the plan. */
export function recoveryText(p) {
  const rules = [
    'Before creating a class, package or module, load the java-conventions skill.',
    'Packages by layer: config, controller, dto, entity, exception, mapper, repository, service.',
    'Services are concrete classes (no *Impl); inject with @RequiredArgsConstructor and private final fields.',
    'DTOs are records named *Dto; *Request / *Response only at the HTTP boundary.',
    'Entities: @Getter @Setter, never @Data; LAZY relations; @Enumerated(EnumType.STRING).',
    p.mapstruct ? 'Mappers: MapStruct with unmappedTargetPolicy = ReportingPolicy.ERROR.' : 'Mapping: static factory methods in the DTO records.',
    'Errors: ProblemDetail from one @RestControllerAdvice.',
    p.liquibase ? 'Schema: add a new Liquibase changeset; never edit one that reached main.' : 'Schema changes go through migrations, never ddl-auto.',
    'Tests: JUnit 5 + AssertJ, slices on H2, @MockitoBean; never @Disabled a failing test.',
    `One class per step; run ${compile(p)} after each step; claim "done" only with build output (java-verification).`,
  ];
  return [
    '[forbxpg-java] The conversation was compacted. Re-anchor:',
    `Project: ${passportLine(p)}`,
    ...rules.map((r, i) => `${i + 1}. ${r}`),
    'Re-read your plan and grillspec notes before the next step.',
  ].join('\n');
}
