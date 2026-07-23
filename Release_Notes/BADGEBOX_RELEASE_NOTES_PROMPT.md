# Standard Release Notes Prompt (Badge Box)

Reusable prompt for generating Badge Box release notes. Copy the block below into
a new Claude Code session, fill in the version number, and it reproduces the same
process and layout every time.

Badge Box is a **monorepo** (`rinbal/Badges_GUI`) with both `backend/` and
`frontend/` folders in the same repository, so there is only one repo to diff,
but the notes must still cover both sides and be synthesized into one set.

---

## Prompt (copy from here)

Generate release notes for Badge Box v{VERSION}. Badge Box is a single monorepo
that contains both a frontend app and a small backend under one repository, so
diff once and synthesize a single set of notes covering both:

- Repo: `rinbal/Badges_GUI` (local clone: this repo). Diff `main` (latest
  released) against `dev` (upcoming release).
- Both sides live in this repo: the frontend under `frontend/` and the backend
  under `backend/`. Attribute each change to the right side when it helps the
  reader, but do not split the notes by folder.

**Process (read-only):**

1. Check `git status` first. Don't touch, stash, or discard any uncommitted work.
2. Confirm the local `main` and `dev` branches match their `origin/*`
   counterparts (fetch if needed). Don't check out either branch, everything
   below is read-only. If `dev` does not exist yet, ask which branch holds the
   unreleased work before diffing, do not assume.
3. Run `git log main..dev --oneline` for the full commit list, and
   `git diff main...dev --stat` for overall scope (files changed,
   insertions/deletions). Note which changes land under `frontend/` vs
   `backend/` from the stat output.
4. Find every `Merge pull request #N` commit in that range. For each, run
   `gh pr view N --repo rinbal/Badges_GUI --json number,title,author,url` to get
   real PR authorship, git commit author isn't always the actual PR submitter.
5. Where a commit's purpose isn't obvious from its message, check the real diff
   (`git show <hash>`, `git diff main...dev -- <path>`) before describing it.
   Never guess, and never assume a feature is in this range just because it
   sounds familiar, verify against the actual diff every time.

**Output:** a single `.md` file named `RELEASE_NOTES_v{VERSION}.md`, saved in the
repo's `Release_Notes/` folder, in exactly this structure. Merge frontend and
backend changes together, sorted by impact, not split by folder:

```markdown
# Badge Box v{VERSION}

## Highlights

- User-facing, notable changes only. Curated and synthesized, not a 1:1 commit
  dump, merge related commits into one bullet. **Bold a short feature name**,
  then one plain-language line. Most exciting/impactful first.

## Technical updates & fixes

- Under-the-hood changes from both frontend and backend: refactors, bug fixes,
  dependency bumps, browser/PWA and relay connectivity fixes, Nostr and
  encryption work (NIP-58 badges, NIP-17/59 DMs, signer/NIP-07 handling),
  backend API / auth changes, i18n sync, tooling and deploy config. Short, terse
  bullets.

## Contributors

Thanks to everyone who shipped this release:

- One bullet per person who authored a merged PR in this range (from the
  `gh pr view` data gathered in step 4, not git log alone, which can miss the
  real submitter). Link each name to `https://github.com/<login>`.
- For external (non-maintainer) contributors, name what they contributed and
  link their specific PR, e.g.
  `- [@name](https://github.com/name): short description of their PR (link the PR)`

## Community
- Group Chat: https://lotus.mybuho.de/join/g/groups.0xchat.com/badgebox?p=https%3A%2F%2Fblossom.primal.net%2F7945fb61e9710ec5ab65722754ac39d0cc7b2d81aeadbde539b4eea4d6880450&a=A+public+community+for+BadgeBox+users%2C+creators%2C+and+anyone+interested+in+NIP-58+badges.+Share+your+badges%2C+exchange+ideas%2C+ask+questions%2C+g&n=BadgeBox+-+the+most+ambitious+badge+creation+tool
- Homepage: https://badgebox.rinbal.de/about
- Try Badge Box: https://badgebox.rinbal.de
- Documentation: https://docs-badgebox.netlify.app
```

The Community section is always exactly those links, verbatim, never change or
regenerate them.

**Style:** valuable and concise. No filler, no padding, no unnecessarily long
text. This is a GitHub release message, not documentation.
no em dashes

## Prompt (copy to here)

---

## Usage

Replace `{VERSION}` with the target version (e.g. `0.4.0`) before sending.
If unsure what the next version should be, ask rather than guessing.
