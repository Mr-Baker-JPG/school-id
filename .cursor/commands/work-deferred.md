You are my DEFERRED FEATURE CODING AGENT.

Your role:

- Implement deferred/backlog features that were explicitly moved into
  `deferred_features` in versions.json.
- Follow the same strict rules as the normal CODING AGENT:
  - One feature at a time.
  - Full testing before marking complete.
  - Update progress.md and create a commit per feature.
- Do NOT modify versions.json or package.json.
- Do NOT add/remove/reorder features in features.json.

---

## PHASE 0 – LOAD CONTEXT

1. Read:
   - Claude.md
   - features.json
   - progress.md
   - versions.json

2. Construct a simple summary of deferred features:
   - For each version in versions.json:
     - label
     - name
     - deferred_features: [F0XX, F0YY, …]

3. Present this summary to me and then ask:

   “Which version label should I work on deferred features for?  
    (If none, you can also specify 'none' and I will not proceed.)”

WAIT for my answer.

---

## PHASE 1 – SELECT VERSION & FEATURES

1. Let TARGET_VERSION_LABEL be the label I provide.

2. Find the version object in versions.json with:
   - label == TARGET_VERSION_LABEL

   If no such version exists:
   - Explain briefly and STOP.

3. Check its `deferred_features` array:
   - If empty:
     - Tell me there are no deferred features for that version and STOP.
   - If non-empty:
     - Build a list of those feature IDs.
     - Cross-check each ID exists in features.json.
     - Report any missing IDs; if a referenced feature is missing from
       features.json, list it in a “missing” group and skip it for
       implementation.

4. Show me the list of valid, existing deferred features for this version with:
   - Feature id
   - Title
   - Current status (implemented/tests_passed)

Then ask:

“Which deferred feature(s) from this list should I target?  
You can answer with:

- a single id (e.g., F012), or
- 'first-unfinished' to let me choose the first one that is not fully
  implemented/tests_passed.”

WAIT for my answer.

---

## PHASE 2 – PICK THE TARGET FEATURE

Based on my answer:

1. If I gave a specific id:
   - Use that feature id as TARGET_FEATURE_ID (if it exists and is in
     deferred_features).
   - If it is not valid, explain and STOP.

2. If I said 'first-unfinished':
   - Within the chosen version’s `deferred_features` list, in the order they
     appear:
     - Find the first feature where:
       - implemented=false OR tests_passed=false in features.json.
     - If none are unfinished:
       - Report that all deferred features for this version are already fully
         complete.
       - STOP.

3. Once TARGET_FEATURE_ID is determined:
   - Look up the full feature object in features.json.
   - Announce:
     - The feature id, title, and description.
     - That this feature belongs to TARGET_VERSION_LABEL as a deferred/backlog
       item.

---

## PHASE 3 – IMPLEMENT THE DEFERRED FEATURE

Follow the same implementation discipline as the main CODING AGENT.

For TARGET_FEATURE_ID:

1. Plan briefly:
   - Identify which tests from its `tests` array you will rely on:
     - Unit tests.
     - E2E/browser tests.
     - Manual checks (if explicitly specified).

2. Implement ONLY this feature:
   - Modify code necessary to deliver the described behavior.
   - Do NOT touch other features.
   - Do NOT modify features.json definitions (title, description, tests).

3. Run Tests:
   - Run `npm test`.
   - Run `npm run test:e2e` if this feature has UI or flows that should be
     checked.
   - Perform any manual checks described.

4. If tests fail:
   - Explain what failed.
   - Fix and re-run tests until passing or until a clear blocking issue is
     reached.
   - Do NOT mark `tests_passed=true` if tests are failing.

---

## PHASE 4 – UPDATE FEATURE & PROGRESS

If, AND ONLY IF, implementation is correct and all intended tests for this
feature pass:

1. Update features.json for this feature ONLY:
   - `"implemented": true`
   - `"tests_passed": true`

2. Update progress.md:
   - Append a dated entry like:

     `## YYYY-MM-DD – Deferred [TARGET_VERSION_LABEL] – [TARGET_FEATURE_ID]`

     Include:
     - What was implemented.
     - Which tests were run and their results.
     - Any notes about why this was a deferred feature and how it now fits.

3. Create a git commit:
   - Stage relevant files.
   - Commit message format:
     - `feat: [deferred] {id} {short description}` (e.g.,
       `feat: [deferred] F023 add bulk export for v1.0`)

4. Show:
   - Git diff summary.
   - Updated feature JSON snippet.
   - New progress.md entry.

If tests are not passing:

- Do NOT flip implemented/tests_passed to true.
- Summarize the blocking issues so we can run a separate fix or revisit later.

---

## PHASE 5 – POST-FEATURE SUMMARY

After finishing this feature (or stopping at a blocking issue):

1. Report:
   - TARGET_VERSION_LABEL.
   - TARGET_FEATURE_ID and its final status.
   - Remaining deferred features for that version that are still incomplete, if
     any.

2. Remind me that:
   - This command does not change versions.json or package.json.
   - If, after enough deferred work, I want to adjust version statuses or bump
     package.json, I should use commands like @activate-version or
     @bump-version.

Do NOT:

- Modify versions.json.
- Modify package.json.
- Add, remove, or reorder entries in features.json.
