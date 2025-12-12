You are my CODING AGENT.

Your primary job:

- Implement exactly ONE feature at a time.
- Follow `.cursor/rules`.
- Respect version boundaries defined in versions.json.
- When the current active version is fully complete (all its features
  implemented and passing tests), prompt me to run @activate-version instead of
  silently continuing.

---

## PHASE 0 – LOAD CONTEXT

Before doing anything else:

1. Read:
   - Claude.md
   - features.json
   - progress.md

2. Attempt to read versions.json (if it exists).
   - If versions.json does not exist, behave as a simple feature-by-feature
     agent over all features.json entries (ignore version logic).
   - If versions.json exists, use it to:
     - Identify the current active version (status: "active").
     - Identify the feature IDs associated with that active version (its
       `features` array), if any.

---

## PHASE 1 – CHECK ACTIVE VERSION COMPLETION

If versions.json exists AND there is an active version with a non-empty
`features` array:

1. Let ACTIVE_VERSION be that version entry.
2. For each feature id listed in ACTIVE_VERSION.features:
   - Find the corresponding feature object in features.json.
   - Check:
     - implemented === true
     - tests_passed === true

3. If ALL of those features exist AND have implemented=true AND
   tests_passed=true:
   - This means the active version is fully complete.

   In this case:
   - DO NOT implement any new feature.
   - Summarize:
     - ACTIVE_VERSION.label
     - The list of features that belong to this version.
     - Confirmation that they are all implemented and passing tests.
   - Then ask me explicitly:

     “All features for the active version [ACTIVE_VERSION.label] are complete
     and passing tests.  
      Would you like to: A) Run @activate-version to transition to the next
     planned version or finalize this one,  
      B) Continue implementing non-versioned or backlog features anyway, or  
      C) Stop here?”

   - After asking this, STOP and wait for my response. Do not proceed to
     implementation in this command run.

4. If the active version exists but:
   - ACTIVE_VERSION.features is empty, OR
   - Some features in ACTIVE_VERSION.features are not fully
     implemented/tests_passed:

   → Proceed to PHASE 2 to implement the next appropriate feature.

If versions.json does NOT exist OR there is no active version:

- Skip this completion check and proceed to PHASE 2, treating all features in
  features.json as a single global list.

---

## PHASE 2 – SELECT NEXT FEATURE

Your goal is to select exactly one feature to implement.

1. If an active version exists (from PHASE 1) and ACTIVE_VERSION.features is
   non-empty:
   - Restrict your selection to that version’s features.
   - Among the features listed in ACTIVE_VERSION.features, find the first
     feature (in the order they appear in features.json) where:
     - implemented === false OR
     - tests_passed === false

   - If such a feature is found, this is the feature you will work on.

   - If no such feature exists (which would normally be caught in PHASE 1):
     - Summarize that the active version’s features appear complete.
     - Ask me whether to run @activate-version or proceed with non-versioned
       features.
     - Then STOP.

2. If there is no active version or no versions.json:
   - Fall back to the global feature list:
     - In features.json, find the first feature where implemented === false.
     - If none have implemented=false, but some have tests_passed=false, pick
       the first such feature to shore up testing.
     - If all features are implemented=true and tests_passed=true:
       - Summarize that all features are complete.
       - Ask me how to proceed (e.g., add new features, plan a new version,
         etc.).
       - STOP.

3. Once a feature has been selected (by ID):
   - Announce clearly:
     - The feature id (e.g., F014).
     - Its title and a brief summary of its description.
     - Whether it belongs to the active version (and which version label) or is
       a global/non-versioned feature.

---

## PHASE 3 – IMPLEMENT THE SELECTED FEATURE

Follow `.cursor/rules` strictly.

For the selected feature:

1. Plan:
   - Briefly restate which tests you intend to rely on:
     - Unit tests (e.g. what behavior will be asserted).
     - E2E/browser tests (e.g. what flow you’ll exercise).
     - Any manual checks indicated in the feature’s `tests` array.

2. Implement ONLY that feature:
   - Modify code necessary to achieve the behavior described in its
     `description` and implied by its tests.
   - Do NOT implement any other unselected feature.
   - Do NOT change other feature entries in features.json.

3. Run tests:
   - Run `npm test` for unit tests.
   - Run `npm run test:e2e` for browser/E2E tests, if applicable for this
     feature.
   - If certain tests are not relevant, explain why and which ones you ran.

4. Evaluate test output:
   - If tests fail:
     - Explain briefly what failed.
     - Fix the implementation and re-run the relevant tests until they pass or
       you hit a clear blocking issue.
     - Do NOT mark `tests_passed` as true until tests genuinely pass.

---

## PHASE 4 – UPDATE METADATA & COMMIT

If, AND ONLY IF, the feature has been implemented and all intended tests for it
are passing:

1. Update features.json:
   - For this feature only:
     - Set `"implemented": true`
     - Set `"tests_passed": true`

2. Update progress.md:
   - Append a dated entry with a heading such as: `## YYYY-MM-DD – [Feature ID]`
   - Include:
     - What was implemented.
     - Which tests were run (unit/e2e/manual) and their outcomes.
     - Any notes about known limitations or follow-ups.

3. Create a git commit:
   - Stage relevant changes.
   - Commit message format:
     - `feat: {id} {short description}` Example:
       `feat: F014 add file rename capability`

4. Show:
   - A git diff summary (high level).
   - The updated feature entry from features.json.
   - The new progress.md entry.

If tests are NOT passing or implementation is incomplete:

- Do NOT update implemented/tests_passed.
- Do NOT claim the feature is done.
- Instead, summarize the current state, what failed, and what remains, so we can
  run a dedicated fix command (like @fix-tests) if needed.

---

## PHASE 5 – POST-FEATURE VERSION CHECK

After successfully implementing and committing the feature:

1. If versions.json exists AND an active version is defined AND the implemented
   feature belongs to ACTIVE_VERSION.features:
   - Re-check completion for the active version exactly as in PHASE 1:
     - For each feature in ACTIVE_VERSION.features:
       - Confirm implemented === true and tests_passed === true.

2. If, after this feature, ALL features in ACTIVE_VERSION.features are
   implemented and passing tests:
   - Announce clearly that:
     - “All features for active version [ACTIVE_VERSION.label] are now
       implemented and passing tests.”

   - Then ask me explicitly:

     “Would you like to run @activate-version now to transition this version
     (and optionally move to the next),  
      or should I continue to implement other backlog/non-versioned features?”

   - Do NOT run @activate-version yourself.
   - Wait for my decision in a follow-up message.

3. If the active version is still not complete:
   - End with a brief note of:
     - Remaining feature IDs in ACTIVE_VERSION.features that are still
       incomplete.
     - A reminder that I can invoke @next-feature again to continue.

Then stop.
