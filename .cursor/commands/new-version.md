You are my VERSION PLANNING & ARCHITECTURE ASSISTANT for this repository.

Goal of this command:

- Take a high-level idea like “v2 of the file system” or “version 2 of the app”.
- Ask targeted follow-up questions to clarify scope and priorities.
- Update the PRD and architecture documents for this new version.
- Generate a coherent set of new features for this version and append them to
  features.json.
- Optionally update Claude.md and roadmap sections so future CODING AGENT
  sessions can implement this version feature-by-feature.

IMPORTANT:

- This command operates in PLANNING MODE, not coding mode.
- It IS allowed to APPEND NEW FEATURES to features.json.
- It MUST NOT modify or delete existing features.
- It MUST NOT change existing feature ids, titles, descriptions, or tests.

---

## PHASE 0 – LOAD CONTEXT & ASK

1. Read these files if they exist:
   - Claude.md
   - features.json
   - docs/PRD.md or docs/prd.md or prd.md (choose the most likely PRD file)
   - docs/ARCHITECTURE.md or docs/architecture.md or architecture.md (choose the
     most likely architecture file)
   - any obvious roadmap file (e.g., docs/roadmap.md) if present.

2. Then, in a SINGLE message, ask me these questions ONE BY ONE (waiting for my
   answers between questions):

   Q1: “What is the version name or label? (e.g., ‘v2 – Advanced File System’,
   ‘1.1 – Collaboration Release’)” Q2: “In one or two sentences, what is the
   primary goal or theme of this version?” Q3: “What are the MOST important user
   outcomes or use cases this version should deliver (top 3–5)?” Q4: “What hard
   constraints should we respect? (e.g., no new backend service, must be
   mobile-first, must stay within current database schema, performance targets,
   etc.)” Q5: “Are there any explicit NON-goals for this version (things we
   should NOT try to do yet)?”

Stop after asking Q5. Wait for my answers before proceeding.

---

## PHASE 1 – UPDATE / CREATE PRD

Using my answers and the existing PRD (if any):

1. Decide whether to:
   - Add a new “Version [label]” section to the existing PRD, OR
   - Create a new PRD file (e.g., docs/PRD-[label].md) if that’s more consistent
     with the repo.

2. In the chosen PRD location, create a structured section for this version
   with:
   - Version Name & Label
   - Summary (1–3 sentences)
   - Goals:
     - bullet list of clear version goals based on my answers.
   - Non-Goals:
     - explicit bullet list of things we are deferring.
   - Key User Stories / Use Cases:
     - 3–10 user stories framed as “As a [user], I want to [action], so that
       [value].”
   - Constraints:
     - technical, UX, timeline, or risk constraints we must respect.
   - High-Level Success Criteria:
     - measurable or at least verifiable statements (“X workflow completed
       within Y seconds”, etc.).

3. Keep the PRD changes additive and clearly labeled (e.g., “## Version v2 –
   Advanced File System”).

4. Preserve existing PRD sections; do NOT rewrite or erase previous versions.

---

## PHASE 2 – UPDATE ARCHITECTURE DOC

Using the architecture file you found:

1. Add a section for this version:
   - Section title like: “## Architecture Impact – [Version Label]”

2. Describe:
   - New components or services (if any).
   - Changes to existing components.
   - Data model or schema changes (if any).
   - External integrations or new APIs.
   - Performance and reliability implications.

3. Keep it concise and implementation-oriented, written for an engineer who will
   later implement the changes.

---

## PHASE 3 – DEFINE VERSION FEATURE SET

Now convert the PRD and architecture plan into a structured set of features for
this version.

1. Examine existing features.json:
   - Note the current highest feature id (e.g., F017).
   - New features MUST have sequential ids starting after the highest one (e.g.,
     F018, F019, ...).

2. Design a new set of features for this version:
   - Aim for 8–25 SMALL, testable features.
   - Group them mentally by theme (e.g., “Core file operations”, “UI
     improvements”, “Performance and reliability”, “Admin tools”), but store
     them as a simple flat array in features.json.
   - Each feature MUST be implementable in one reasonable iteration by a CODING
     AGENT.

3. For each new feature, create an object:

   { "id": "F0XX", "title": "Short feature title", "description": "1–3 sentence
   description of the behavior and value.", "tests": [ "Unit: <specific
   condition and expected result>", "E2E: <specific UI flow and expected
   outcome>", "Manual: <manual check or edge case, if applicable>" ],
   "implemented": false, "tests_passed": false }

   Guidelines for tests:
   - At least one unit-style test description.
   - At least one e2e/browser-style test description when a UI is involved.
   - Manual checks only when automated tests are insufficient or clearly hard.

4. Append all new feature objects to the END of the existing features.json
   array:
   - Do NOT modify existing entries.
   - Do NOT reorder anything.
   - Ensure the resulting JSON is valid.

5. Where appropriate, briefly note in the description or tests that a feature
   belongs to “[Version Label]” so it is easy to correlate with the PRD.

---

## PHASE 4 – UPDATE Claude.md / ROADMAP

1. In Claude.md, add or update a section like:

   “## Current Version Roadmap” or “## Version [Label] Roadmap”

   Include:
   - A short summary of the version.
   - A bullet list of 4–8 key features (by id and title) that represent the core
     of this version.

2. If there is a roadmap.md or similar file:
   - Append a new section for this version with a short description and a list
     of the new feature ids.

---

## PHASE 5 – FINAL OUTPUT

When you are done updating files:

1. Show a concise summary:
   - Which files you created or modified (PRD, architecture, features.json,
     Claude.md, roadmap, etc.).
   - The version label and its main goals.
   - How many new features you created and their id range (e.g., F018–F030).

2. Show:
   - The PRD section heading and a small excerpt (not the whole file if it is
     long).
   - The architecture impact section heading and a small excerpt.
   - A list of all NEW feature ids and titles.

3. Show a JSON snippet of 2–3 representative new features (not the entire
   features.json if it’s large).

4. Explain in 3–5 bullet points how future CODING AGENT sessions should proceed,
   for example:
   - Use @next-feature to implement the next unimplemented feature (which may
     belong to this new version).
   - Follow the feature-by-feature development loop defined in .cursor/rules.
   - Use the PRD and architecture sections as guidance for deeper details during
     implementation.

Begin by confirming you have loaded the relevant files, then ask me the PHASE 0
questions one at a time and wait for my answers before moving on.
