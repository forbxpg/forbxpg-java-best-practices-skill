package com.example;

import static com.tngtech.archunit.base.DescribedPredicate.not;
import static com.tngtech.archunit.core.domain.JavaModifier.FINAL;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.fields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaField;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import com.tngtech.archunit.library.GeneralCodingRules;

/**
 * Team code rules (forbxpg-java, java-quality-gates). Each rule names its hook rule id.
 * Put this class in the application's base package; it analyses that package and below.
 * Do not weaken a rule to get a change through: fix the code, or ask the team.
 */
@AnalyzeClasses(packagesOf = CodeRulesTest.class)
class CodeRulesTest {

    private static final DescribedPredicate<JavaClass> IN_TESTS = new DescribedPredicate<>("compiled from test sources") {
        @Override
        public boolean test(JavaClass c) {
            return c.getSource().map(s -> s.getUri().toString().contains("/test-classes/")).orElse(false);
        }
    };

    private static final String ENTITY = "jakarta.persistence.Entity";
    private static final String SERVICE = "org.springframework.stereotype.Service";
    private static final String REST_CONTROLLER = "org.springframework.web.bind.annotation.RestController";
    private static final String CONTROLLER = "org.springframework.stereotype.Controller";
    private static final String SPRING_DATA_REPOSITORY = "org.springframework.data.repository.Repository";

    private static final DescribedPredicate<JavaClass> CONTROLLERS = annotatedWithAny(REST_CONTROLLER, CONTROLLER);

    @ArchTest
    static final ArchRule j1_no_field_injection = noFields()
            .that().areDeclaredInClassesThat(not(IN_TESTS))
            .should().beAnnotatedWith("org.springframework.beans.factory.annotation.Autowired")
            .because("J1: inject through the constructor with Lombok @RequiredArgsConstructor and private final fields")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule j2_no_javax = noClasses()
            .should().dependOnClassesThat().resideInAnyPackage("javax.persistence..", "javax.validation..", "javax.servlet..")
            .because("J2: Spring Boot 3+ uses the jakarta.* packages")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule j3_no_standard_streams = noClasses()
            .that(not(IN_TESTS))
            .should(GeneralCodingRules.ACCESS_STANDARD_STREAMS)
            .because("J3: log through SLF4J (@Slf4j) and pass the exception as the last argument")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule j5_no_junit4 = noClasses()
            .that(IN_TESTS)
            .should().dependOnClassesThat().resideInAnyPackage("org.junit", "org.junit.runner")
            .because("J5: JUnit 4 tests do not run on the JUnit 5 platform; use org.junit.jupiter.api")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule w2_to_one_relations_are_lazy = fields()
            .that().areAnnotatedWith("jakarta.persistence.ManyToOne")
            .or().areAnnotatedWith("jakarta.persistence.OneToOne")
            .should(new ArchCondition<JavaField>("declare fetch = FetchType.LAZY") {
                @Override
                public void check(JavaField field, ConditionEvents events) {
                    boolean lazy = field.getAnnotations().stream()
                            .filter(a -> a.getRawType().getName().matches("jakarta\\.persistence\\.(ManyToOne|OneToOne)"))
                            .anyMatch(a -> String.valueOf(a.get("fetch").orElse("EAGER")).endsWith("LAZY"));
                    if (!lazy) {
                        events.add(SimpleConditionEvent.violated(field, field.getFullName() + " is EAGER (W2): add fetch = FetchType.LAZY"));
                    }
                }
            })
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule w3_enums_stored_by_name = fields()
            .that().areDeclaredInClassesThat().areAnnotatedWith(ENTITY)
            .and().haveRawType(enumType())
            .should(new ArchCondition<JavaField>("be annotated with @Enumerated(EnumType.STRING)") {
                @Override
                public void check(JavaField field, ConditionEvents events) {
                    boolean byName = field.getAnnotations().stream()
                            .filter(a -> a.getRawType().getName().equals("jakarta.persistence.Enumerated"))
                            .anyMatch(a -> String.valueOf(a.get("value").orElse("ORDINAL")).endsWith("STRING"));
                    if (!byName) {
                        events.add(SimpleConditionEvent.violated(field, field.getFullName() + " is stored by position (W3): add @Enumerated(EnumType.STRING)"));
                    }
                }
            })
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule w4_transactional_methods_are_proxyable = methods()
            .that().areAnnotatedWith("org.springframework.transaction.annotation.Transactional")
            .should().notBePrivate()
            .andShould().notHaveModifier(FINAL)
            .because("W4: the Spring proxy ignores @Transactional on private and final methods")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule w9_controllers_do_not_use_repositories = noClasses()
            .that(CONTROLLERS)
            .should().dependOnClassesThat().areAssignableTo(SPRING_DATA_REPOSITORY)
            .orShould().dependOnClassesThat().areAnnotatedWith("org.springframework.stereotype.Repository")
            .because("W9: controllers call services; services own data access")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule controllers_do_not_expose_entities = noClasses()
            .that(CONTROLLERS)
            .should().dependOnClassesThat().areAnnotatedWith(ENTITY)
            .because("controllers take and return DTO records, never JPA entities")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule services_do_not_depend_on_controllers = noClasses()
            .that().areAnnotatedWith(SERVICE)
            .should().dependOnClassesThat(CONTROLLERS)
            .because("dependencies point controller → service → repository")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule repositories_do_not_depend_on_services = noClasses()
            .that().areAssignableTo(SPRING_DATA_REPOSITORY)
            .should().dependOnClassesThat().areAnnotatedWith(SERVICE)
            .because("dependencies point controller → service → repository")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule exception_handlers_live_in_the_advice = methods()
            .that().areAnnotatedWith("org.springframework.web.bind.annotation.ExceptionHandler")
            .should().beDeclaredInClassesThat(annotatedWithAny(
                    "org.springframework.web.bind.annotation.RestControllerAdvice",
                    "org.springframework.web.bind.annotation.ControllerAdvice"))
            .because("one @RestControllerAdvice maps exceptions to ProblemDetail for the whole application")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule services_do_not_return_response_entity = noMethods()
            .that().areDeclaredInClassesThat().areAnnotatedWith(SERVICE)
            .should().haveRawReturnType("org.springframework.http.ResponseEntity")
            .because("HTTP types belong to controllers")
            .allowEmptyShould(true);

    private static DescribedPredicate<JavaClass> annotatedWithAny(String... annotations) {
        return new DescribedPredicate<>("annotated with any of " + String.join(", ", annotations)) {
            @Override
            public boolean test(JavaClass c) {
                for (String annotation : annotations) {
                    if (c.isAnnotatedWith(annotation)) {
                        return true;
                    }
                }
                return false;
            }
        };
    }

    private static DescribedPredicate<JavaClass> enumType() {
        return new DescribedPredicate<>("an enum") {
            @Override
            public boolean test(JavaClass c) {
                return c.isEnum();
            }
        };
    }
}
