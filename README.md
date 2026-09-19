# Splicemark

Splicemark is a shared-tree editing CLI for coding agents.

It performs attributable line or character edits, safely relocates shifted boundaries, surfaces only locally relevant peer work, and leaves ordinary Git as the aggregate source of truth.

## Model

Each session records a task description and a persisted actor type: `agent`, `human`, or `automation`. New sessions default to `agent`. Stored sessions created before actor types existed are reported as `unknown`; Splicemark does not rewrite them to a type that was never recorded.

Relation and actor type are separate dimensions. `YOU` / `PEER` says how a tracked session relates to the session requesting the diff, while `AGENT` / `HUMAN` / `AUTOMATION` says what kind of actor owns that session. Tracked attribution therefore uses forms such as `[YOU · AGENT · sm-12345678 · Refactor movement]` and `[PEER · AUTOMATION · sm-87654321 · Regenerate bindings]`.

All sessions edit the same working tree. Splicemark records exact mutations made through its edit command, so tracked authorship is captured when the change happens instead of inferred later from a whole-file diff.

Coordination state lives under `.git/splicemark/` and never enters the project working tree.

## Workflow

```sh
splicemark start "Fix proxy lifecycle" --actor=agent
# sm-7f3a91bc

splicemark edit sm-7f3a91bc src/Foo.js \
  --lines 37:61 \
  --expect-start "first expected line" \
  --expect-end "last expected line" <<'EOF'
replacement
EOF

splicemark diff sm-7f3a91bc
splicemark finish sm-7f3a91bc
splicemark clean
```

Ranges are 0-based and inclusive. Use `--chars START:END` instead of `--lines START:END` for character ranges.

Single `edit` commands can relocate a stale target when both expected boundaries moved by the same unique offset. Ambiguous or internally changed regions are refused rather than guessed.

For multiple writes to one file, validate every boundary first against the same file snapshot, then use one prevalidated batch:

```sh
splicemark batch sm-7f3a91bc src/Foo.js --lines <<'JSON'
[
  {"start":90,"end":92,"replacement":"replacement near bottom"},
  {"start":37,"end":41,"replacement":"replacement near top"}
]
JSON
```

Batch input order does not matter. Splicemark rejects overlapping ranges, sorts accepted ranges bottom-to-top, and applies them in one invocation. Batch mode deliberately does not validate expected boundary text or relocate ranges; the agent performs that validation immediately beforehand.

## Peer Awareness

When another active session has authored overlapping code, the edit result includes that peer edit with its actor type, session ID, and task description. Unrelated sessions remain invisible.

Exceptional coordination notes can be attached to a region:

```sh
splicemark note sm-7f3a91bc src/Foo.js \
  --lines 80:95 \
  --message "Keep this return shape stable; the worker consumes it."
```

A note is surfaced only when another session edits the same region. Notes are scoped to the `HEAD` where they were created and become inactive immediately when `HEAD` changes.

## Git Lifecycle

Splicemark does not create branches, worktrees, commits, staging state, or merges.

`splicemark diff SESSION` stays task-local: it shows the requesting session's active authored files, relevant active peer edits in those files, and proven residual dirty regions in those same files. It does not become a repository-wide dirty-tree dump. Normal `git diff` remains the aggregate working-tree view.

For each relevant file, Git `HEAD` plus the current workspace are the source of truth for what is dirty, while active Splicemark edit records remain the source of truth for tracked authorship. Splicemark replays attributable edits exactly against the real HEAD-to-working-tree changes. A residual region that is provably not represented by an active Splicemark edit is shown as `[UNATTRIBUTED · HUMAN · working-tree]` under the operating model that agent and automation writes go through Splicemark.

That HUMAN label means "manual residual working-tree change not attributable to a tracked Splicemark session"; it does not identify a physical person cryptographically. If a manual mutation overlaps or invalidates tracked authorship so exact subtraction is ambiguous, Splicemark reports UNKNOWN/stale attribution instead of guessing HUMAN.

Agent and automation writes should therefore go through Splicemark whenever their authorship is expected to remain attributable.

Diff hunk coordinates and per-line old/new gutters are 0-based by default for agent and programmatic workflows. Use `--line-base=1` for conventional human/editor coordinates; `--line-base=0` is exactly equivalent to the default. The CLI also accepts the repository's conventional spaced option form, such as `--line-base 1`.

Unchanged source context defaults to 0. Use `--context=N` or `--context N` to show up to N real unchanged source lines before and after each attributed or residual edit. Git-style aliases `--unified=N`, `--unified N`, `-UN`, and `-U N` are exactly equivalent. Context is read from the current workspace source after attribution locations have been reconciled, and all hunk/gutter coordinates use the selected `--line-base=0|1`.

When `HEAD` changes, committed authored changes are retired, still-uncommitted attributable changes may remain active, and ambiguous attribution becomes stale rather than being reassigned. Diff-time working-tree verification also refuses to render an active record as current authorship when its exact mutation can no longer be proven in the current dirty tree.

## Commands

```text
splicemark start "task description" [--actor=agent|human|automation]
splicemark edit SESSION FILE --lines START:END --expect-start TEXT --expect-end TEXT
splicemark edit SESSION FILE --chars START:END --expect-start TEXT --expect-end TEXT
splicemark batch SESSION FILE --lines < splices.json
splicemark batch SESSION FILE --chars < splices.json
splicemark note SESSION FILE --lines START:END --message TEXT
splicemark note SESSION FILE --chars START:END --message TEXT
splicemark diff SESSION [--line-base=0|1] [--context=N]
splicemark finish SESSION
splicemark clean
```

`finish` marks a session inactive. `clean` removes finished sessions, expired notes, and retired edit records while preserving active work and stale-attribution warnings.

See `POLICY.md` for the behavioral source of truth.
