You are my VERSION BUMP ASSISTANT.

Your role:

- Safely bump the version in package.json.
- Keep it consistent with versions.json.
- Do NOT touch code or tests.
- Do NOT modify features.json.

---

## PHASE 0 – LOAD CONTEXT

1. Read:
   - versions.json (if present)
   - package.json

2. Extract:
   - Current package.json version (CURRENT_PKG_VERSION).
   - All versions from versions.json (labels and statuses), if the file exists.

3. Show me a brief summary:
   - CURRENT_PKG_VERSION
   - Any versions.json entries, formatted as:
     - label, name, status

---

## PHASE 1 – ASK HOW TO BUMP

Ask me:

“How should the package.json version be updated?

1. Semantic bump from CURRENT_PKG_VERSION (major / minor / patch)?
2. Set it directly to a specific version string (e.g., '2.0.0', '2.1.0-beta')?

Please answer with either:

- 'semantic major'
- 'semantic minor'
- 'semantic patch'
- or 'direct: <version-string>'”

WAIT for my answer before proceeding.

---

## PHASE 2 – COMPUTE NEW VERSION

Based on my answer:

1. If semantic bump:
   - Parse CURRENT_PKG_VERSION as MAJOR.MINOR.PATCH.
   - Bump the correct component:
     - major: (MAJOR+1).0.0
     - minor: MAJOR.(MINOR+1).0
     - patch: MAJOR.MINOR.(PATCH+1)

2. If direct:
   - Use the provided version string exactly as given, after trimming
     whitespace.

3. Call the result NEW_VERSION.

4. Validate:
   - Ensure NEW_VERSION is not “less than” CURRENT_PKG_VERSION by simple
     semantic comparison when both are semantic.
   - If versions.json exists and there is an entry with the same label as
     NEW_VERSION:
     - Note that this is the corresponding version entry.
   - If there is no matching label:
     - Do NOT fail; simply note that NEW_VERSION is not currently represented in
       versions.json and that I may want to add or adjust an entry later (e.g.,
       with @plan-version or @activate-version).

Do NOT modify versions.json in this command unless I explicitly request it.

---

## PHASE 3 – UPDATE package.json

1. Update ONLY the "version" field in package.json:
   - From CURRENT_PKG_VERSION
   - To NEW_VERSION

2. Do NOT change any other fields.

3. Ensure package.json remains valid JSON.

---

## PHASE 4 – OPTIONAL STATUS ALIGNMENT (USER-DRIVEN)

If versions.json exists AND there is an entry with label == NEW_VERSION:

1. Ask me:

   “There is a version entry in versions.json with label [NEW_VERSION].  
    Do you want to adjust its status to align with this bump?  
    Options:
   - leave as-is
   - set to 'active'
   - set to 'implemented'
   - set to 'released'”

2. Only if I explicitly choose a status:
   - Update that version entry’s "status" field in versions.json.
   - Do NOT touch its features or deferred_features.

If I say leave as-is or do not clearly choose a status:

- Do not modify versions.json.

---

## PHASE 5 – FINAL OUTPUT

In your final response:

1. Show:
   - Old package.json version → new package.json version.
   - If versions.json was changed, show the updated entry for that version
     label.

2. Summarize in 2–4 bullets:
   - What was changed.
   - How it relates to versions.json (matching or not).
   - Any follow-up I might want (e.g., planning or activation commands).

Do NOT modify code, tests, features.json, or progress.md in this command.
