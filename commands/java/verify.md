---
description: Compile and test the project and show the build output as proof
---

Verify that the project builds and its tests pass, with evidence.

1. Load the `java-verification` skill and follow it.
2. Run the project's build with its Maven wrapper if it works, otherwise `mvn`: first
   `-q compile`, then the tests (`test`, or `verify` when the project has quality gates).
   Never skip tests or checks (`-DskipTests` and the like).
3. Show the commands you ran and the end of their output. Claim success only when the output
   shows it. If something fails, list the failures with file and line, and ask before fixing.
