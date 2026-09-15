# Splicemark

Splicemark is a shared-tree editing CLI for coding agents.

It performs attributable line or character edits, safely relocates shifted boundaries, surfaces only locally relevant peer work, and leaves ordinary Git as the aggregate source of truth.

## Model

Each agent starts a session with a short task description. All sessions edit the same working tree. Splicemark records exact mutations made through its edit command, so authorship is captured when the change happens instead of inferred later from a whole-file diff.

Coordination state lives under `.git/splicemark/` and never enters the project working tree.

## Workflow

```sh
splicemark start "Fix proxy lifecycle"
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

When another active session has authored overlapping code, the edit result includes that peer edit with its session ID and task description. Unrelated sessions remain invisible.

Exceptional coordination notes can be attached to a region:

```sh
splicemark note sm-7f3a91bc src/Foo.js \
  --lines 80:95 \
  --message "Keep this return shape stable; the worker consumes it."
```

A note is surfaced only when another session edits the same region. Notes are scoped to the `HEAD` where they were created and become inactive immediately when `HEAD` changes.

## Git Lifecycle

Splicemark does not create branches, worktrees, commits, staging state, or merges.

`splicemark diff SESSION` shows that session's active authored changes. Normal `git diff` remains the aggregate working-tree view.

When `HEAD` changes, committed authored changes are retired, still-uncommitted attributable changes may remain active, and ambiguous attribution becomes stale rather than being reassigned.

## Commands

```text
splicemark start "task description"
splicemark edit SESSION FILE --lines START:END --expect-start TEXT --expect-end TEXT
splicemark edit SESSION FILE --chars START:END --expect-start TEXT --expect-end TEXT
splicemark batch SESSION FILE --lines < splices.json
splicemark batch SESSION FILE --chars < splices.json
splicemark note SESSION FILE --lines START:END --message TEXT
splicemark note SESSION FILE --chars START:END --message TEXT
splicemark diff SESSION
splicemark finish SESSION
splicemark clean
```

`finish` marks a session inactive. `clean` removes finished sessions, expired notes, and retired edit records while preserving active work and stale-attribution warnings.

See `POLICY.md` for the behavioral source of truth.
