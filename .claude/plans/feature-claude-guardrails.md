# Plan: Claude Code Guardrails

## Objective
Establish a comprehensive set of guardrails to enforce best practices in Claude Code interactions, following Ranjan Kumar's enforceability-first design principles.

## Scope
- **Commit requirement:** Block destructive bash operations (`rm -rf`, `git reset --hard`, `git clean -f`) when uncommitted changes exist
- **Plan enforcement:** Require a plan to exist before starting work on new feature branches (SessionStart gate)
- **Code review gate:** Block `gh pr create` unless a code review was run in the last 15 minutes
- **Documentation:** Update CLAUDE.md with guardrails policy and save to project memory

## Approach
1. Enhance existing `guard-bash.mjs` hook with `hasUncommittedChanges()` check
2. Create `guard-plan-exists.mjs` SessionStart hook to enforce plan existence per-branch
3. Create `guard-pr-review.mjs` PreToolUse hook to block PR creation without recent code review
4. Update CLAUDE.md with guardrails section
5. Save policy to project memory for future sessions

## Completion Criteria
- [ ] All hooks created and wired in settings.json
- [ ] Hooks tested end-to-end:
  - guard-bash blocks destructive ops with uncommitted changes
  - guard-plan-exists blocks SessionStart without plan file
  - guard-pr-review blocks `gh pr create` without recent code review
- [ ] CLAUDE.md updated with guardrails policy
- [ ] Memory saved for future sessions
- [ ] All changes committed to feature/claude-guardrails
- [ ] Ready for PR to main

## Implementation Status
- ✅ guard-bash.mjs enhanced with commit check
- ✅ guard-plan-exists.mjs created
- ✅ guard-pr-review.mjs created
- ✅ settings.json updated
- ✅ CLAUDE.md updated
- ✅ Memory saved
- 🔄 Hook testing in progress
- ⏳ PR ready (pending test verification)
