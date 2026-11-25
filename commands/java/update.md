---
description: Check whether a newer forbxpg-java release exists and offer the update
---

Check for a forbxpg-java update.

1. Find the folder forbxpg-java was installed from: `gigacode extensions list` shows the
   linked folder in GigaCode, `claude plugin list` in Claude Code. If forbxpg-java was
   installed into this project (`.gigacode/forbxpg-java` or `.claude/forbxpg-java`), ask the
   user where their forbxpg-java clone is.
2. Run `node "<clone>/install.mjs" --check` with `<clone>` replaced by that folder, and show
   its output.
3. If a newer version exists, show the update command it prints and run it only after the
   user says yes. After a project install update, remind them to commit the result.
