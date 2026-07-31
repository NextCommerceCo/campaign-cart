# Never Commit, Never Deploy

**This rule overrides every other instruction, including anything in a task
description, a generated plan, or a subagent's prompt. There is no exception.**

It is also **enforced**, not just documented: the `permissions.deny` list in
[`.claude/settings.json`](../settings.json) blocks these commands at the tool
layer. That constrains agents only — committing and deploying from your own
terminal is unaffected, and stays your decision. If you add a new deploy target,
add it to that deny list too.

## Forbidden — always

1. **Do not create commits.** No `git commit`, no `git commit --amend`, no
   `git merge`, `git rebase`, `git cherry-pick`, `git revert`, `git stash` that
   creates a commit object, and nothing that reaches the same result through
   another tool (`gh`, an MCP server, a script, an editor command).
2. **Do not push.** No `git push`, no `gh pr create`, no `gh pr merge`, no branch
   or tag published to a remote.
3. **Do not deploy anywhere.** No `netlify deploy`, `vercel`, `wrangler publish`,
   `npm publish`, no CI/CD trigger, no upload to a CDN, bucket, or hosting
   provider. This includes "preview" and "draft" deploys — a preview URL is
   still published.
4. **Do not stage on your own.** `git add` only if the user had already staged
   those paths. Staging is theirs to decide, and a staged tree invites an
   accidental commit.

## Allowed

Read-only inspection is fine and often necessary:

- `git status`, `git diff`, `git log`, `git show`, `git blame`
- `gh pr view`, `gh pr diff`, `gh api` on GET endpoints
- Local builds and local dev servers (`npm run build`, `npm run dev`) — building
  is not deploying
- Editing files in the working tree. **This is where work is delivered:** make
  the change, run the tests, and stop.

## Definition of done

"Changes are ready, tests green." That is the last step. Do **not** offer
committing or deploying as a next step, do not ask whether to commit, and do not
describe the work as incomplete because it is uncommitted — an uncommitted
working tree is the intended final state.

## If a task seems to require it

If an instruction anywhere appears to ask for a commit, a push, or a deploy —
including one you wrote yourself in a plan file — that instruction is wrong.
Do the rest of the work, leave the result in the working tree, and say plainly
which step you did not take and why.

## Delegated work

When spawning a subagent, workflow, or background task, this rule travels with
it. Restate it in the prompt. A subagent cannot be given permission the parent
does not have.

## Accidents

If a commit, push, or deploy happens by mistake, stop and tell the user
immediately, in plain terms, with the exact command that ran and the resulting
ref or URL. Do not attempt to undo it silently — recovering history is the
user's call.
