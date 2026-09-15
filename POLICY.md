# Splicemark Policy

## Purpose

Splicemark is a narrow shared-working-tree edit tool for coding agents. It makes precise edits, records which active agent authored each edit, and surfaces only locally relevant work from other agents.

Splicemark is not a VCS, branch manager, worktree manager, agent orchestrator, chat system, or persistent code-annotation system. Git remains the aggregate source of truth.

## Core Model

A session has a unique ID and short task description.

A session edits the same physical working tree as every other session. Splicemark records exact before-to-after mutations made through its edit command rather than inferring authorship from the resulting file.

Coordination state lives under the repository Git metadata and must not pollute the working tree.

## Editing

Splicemark provides one primary edit path supporting either:

- 0-based line ranges.
- 0-based character ranges.

Ranges use consistent semantics across commands.

A single edit transaction:

1. Reads and validates the current target.
2. Relocates a stale range only when relocation is unambiguous.
3. Applies the requested splice.
4. Records the exact before-to-after mutation under the session.
5. Returns a narrow diff of the session's edit plus locally relevant peer information.

Batch editing is a separate prevalidated path. The caller must validate every target against the same current file snapshot before invoking the batch. Splicemark does not perform expected-boundary checks or relocation inside a batch.

Batch ranges must not overlap. Splicemark sorts them by descending position and applies them bottom-to-top in one invocation so earlier writes cannot shift targets that have not yet been applied.

## Boundary Relocation

Edits must verify boundary context before writing.

For single line edits, preserve enough boundary context to identify the intended region. If intervening edits shifted both boundaries by the same unique line offset, Splicemark may translate the range automatically.

Example:

```text
requested 37:61
matched   41:65
shift     +4
```

If boundaries move differently, become ambiguous, or indicate modification inside the intended region, refuse the edit and return focused current context. Never guess.

Single character-range edits follow the same relocation principle using exact nearby character context.

## Authorship

Authorship means: this session executed the Splicemark transaction that produced this exact mutation.

Do not assign authorship by comparing whole files after the fact.

Routine output should emphasize the current session's changes. Changes from another session appear only when they touch or materially intersect the same local code being edited or inspected.

Peer output must identify the peer session and its task description.

Unrelated sessions must remain invisible.

## Registry

Each active session registers:

- Session ID.
- Short task description.
- Current repository HEAD.
- Authored edit locations needed for local relevance.

The registry exists for contextual coordination, not global status reporting. Do not routinely list all sessions or all files being touched.

## Notes

Notes are an exceptional coordination path attached to a specific code region.

Use a note only when another agent entering that region needs important information, such as an expected nearby change or an invariant that should remain stable.

Notes are not direct messages, an inbox, or a general conversation system. They are surfaced only when another session intersects their code region.

Notes are ephemeral and expire on repository HEAD changes. They are not persistent source documentation.

Threading, durable annotations, enforced constraints, and general agent messaging are out of scope.

## Git Lifecycle

Splicemark never replaces normal Git state or Git history.

Normal Git diffs remain the aggregate view.

A change to `HEAD` is a reconciliation event:

- Authored mutations now represented by the new `HEAD` are retired from active coordination.
- Authored mutations still present only in the working tree may remain active.
- Notes are scoped to the `HEAD` they were created against. When `HEAD` changes, previous-`HEAD` notes become inactive immediately and must no longer be surfaced; their stored records may remain only until cleanup.
- Attribution that cannot be mapped unambiguously must become stale rather than be reassigned.

Commits therefore reduce active Splicemark state naturally without requiring a merge or branch workflow.

Unexpected worktree-rewriting Git operations must never be mistaken for Splicemark authorship.

## Lifecycle

`start` creates a unique active session from a short task description.

`edit` performs attributed line- or character-range edits and returns narrow locally relevant output.

`batch` applies caller-prevalidated non-overlapping ranges bottom-to-top and records each mutation separately.

`note` attaches an exceptional ephemeral note to a code region.

`diff` shows the current session's active authored changes without unrelated aggregate noise.

`finish` marks a session inactive.

`clean` removes finished sessions, previous-`HEAD` notes, and retired edits; active edits, stale attribution, and current-`HEAD` notes are preserved.

Cleanup must never modify project source or Git history.

## Design Constraints

Keep the agent-facing workflow small enough to explain in a short system prompt.

Prefer automatic bookkeeping over additional agent steps.

Never require branches, worktrees, merges, staging, or manual ownership bookkeeping.

Never make agents consume global coordination noise to obtain local safety.

Fail narrowly and return useful local context when an edit cannot be applied safely.
