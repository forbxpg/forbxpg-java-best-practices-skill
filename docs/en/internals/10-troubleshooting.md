# 10. Troubleshooting

## The hook is silent

Check in this order.

1. **Did you open a new session after the install?** Harnesses read hooks at startup.
2. **Are hooks enabled?** GigaCode: check that `~/.gigacode/settings.json` does not contain
   `"disableAllHooks": true`. Codex: check that trust was given in `/hooks`. Claude Code:
   check that the plugin is visible in `/plugin` and the hooks in `/hooks`.
3. **Is Node on `PATH`?** The hook is `node ...`. Without Node the harness gets a launch
   error, and the model sees nothing.
4. **Does the hook find the Maven project?** If there is no `pom.xml` either above the
   session folder or in a single subfolder, the hook exits silently. With two Maven
   subfolders and no file write, it is also silent.
5. **A GigaCode project install with the session in a subfolder?** GigaCode does not read
   the parent folder's `.gigacode/settings.json`. Open the session in the repository root.
6. **Is the rule disabled?** Look at `disable` in the project's `forbxpg-java.json` and in
   `~/.forbxpg-java.json`.
7. **Is this a new violation?** The hook blocks only what the edit introduced. An old
   violation in the file is not blocked.

## Run the hook by hand

This is the fastest way to see what the hook will answer. From the project root:

```bash
echo '{"session_id":"debug","cwd":"'"$PWD"'","tool_name":"Write","tool_input":{"file_path":"src/main/java/a/X.java","content":"class X {\n  @Autowired\n  private Object o;\n}\n"}}' \
  | node <path to hooks>/java-hooks.mjs PreToolUse --harness claude
echo "exit=$?"
```

The expected result is the text `[forbxpg-java] J1: ...` and `exit=2`.

The passport:

```bash
echo '{"session_id":"debug","cwd":"'"$PWD"'","source":"startup"}' \
  | node <path to hooks>/java-hooks.mjs SessionStart --harness gigacode
```

In Windows `cmd` it is easier to do the same through a file: save the JSON to `in.json` and
run `node <path>\java-hooks.mjs PreToolUse --harness gigacode < in.json`, then
`echo %ERRORLEVEL%`.

Where the hooks are: for the Claude Code plugin, the plugin folder; for the GigaCode
extension, the repository folder; for a project install, `.claude/forbxpg-java/hooks/` or
`.gigacode/forbxpg-java/hooks/`.

## hook.log

Internal hook errors: `<tmp>/forbxpg-java/<12 characters of the project hash>/<session_id>/hook.log`.
`<tmp>` is `%TEMP%` on Windows, `$TMPDIR` on macOS, and usually `/tmp` on Linux.

- The line `invalid JSON on stdin` in the `unknown` folder means the hook was called with
  invalid input (often a manual call). A session from a harness always comes with a
  `session_id`.
- An exception stack trace is a bug in the hook code. The hook still exited with code 0 and
  did not get in the way of the work.

## The hook gets in the way

- **The model hit a refusal and asks what to do.** This is by design: the user decides.
  Either accept the fix, or disable the rule for the project in `forbxpg-java.json`
  (`"disable": ["J1"]`).
- **Stop keeps reporting that the build could not be checked.** The hook compiles offline
  (`-o`). Warm up the Maven cache with a normal build with network access. If you do not
  want compilation at the end of a turn, set `"stopCompile": false`.
- **Stop blocks on an error the model cannot fix.** After two blocks since the last
  successful build, the hook lets the turn end with a message to the user.
- **The build is slow.** The hook builds only the changed modules (`-pl ... -am`) and
  offline. If even that takes longer than 180 s, the hook stops the build and tells the
  user.

## The hook behaves differently in another harness

Compare with the table in [08](08-harnesses.md). Common causes:

- in Codex, Java rules do not block; they are reported after the patch;
- Claude Code has no context fill warning: Claude Code does not send `context_usage`;
- the anchor is on by default only in GigaCode.

## Uninstall did not restore the project as it was

`--uninstall` restores `settings.json` and `GIGACODE.md` only if, after its own entries are
cleaned out, no new settings from anyone else are left in them. If the team added its own
keys after the install, they are kept, and the file stays. This is intentional: uninstall
does not touch what is not its own.
