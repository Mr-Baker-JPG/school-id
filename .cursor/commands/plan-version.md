You are my VERSION PLANNING ASSISTANT.

This command is for PLANNING ONLY. It must NOT:

- modify code
- modify package.json
- modify features.json

It MAY:

- update or create version-planning documents
- update PRD and architecture docs to describe the new version
- create or update versions.json as a source of truth about planned and active
  versions.

---

## PHASE 0 – LOAD CONTEXT & ASK

1. Load context:
   - Read Claude.md if it exists.
   - Read versions.json if it exists.
   - Read any PRD and architecture docs:
     - PRD candidate paths (in order of preference): docs/PRD.md, docs/prd.md,
       PRD.md, prd.md
     - Architecture candidate paths: docs/ARCHITECTURE.md, docs/architecture.md,
       ARCHITECTURE.md, architecture.md

2. In a SINGLE message, ask me these questions ONE AT A TIME (wait for my answer
   between questions):

   Q1: “What is the version label? (e.g., ‘2.0.0’, ‘v2’, ‘1.1 – Collaboration
   Release’)” Q2: “Give me a one- or two-sentence summary of what this version
   is about.” Q3: “What are the top 3–7 user outcomes or use cases this version
   should deliver?” Q4: “What hard constraints or boundaries should this version
   respect? (technical limits, UX constraints, performance targets, timelines,
   etc.)” Q5: “Are there any explicit NON-goals for this version (things we
   intentionally will NOT do in this version)?”

Stop after Q5, then WAIT for my answers before continuing.

---

## PHASE 1 – CREATE / UPDATE versions.json

Goal: Maintain a machine-friendly registry of versions.

1. If versions.json does NOT exist:
   - Create it at the repo root with an array of version objects.

2. Interpret any existing version entries to detect:
   - the current “active” or “implemented” version, based on existing structure.
   - If no structure exists yet, introduce this canonical shape:

   Each element in versions.json should look like:

   { "label": "1.0.0", "name": "Initial Release", "status": "active", //
   allowed: "planned" | "active" | "implemented" | "released" "notes": "Short
   free-form notes about this version.", "features": [] // array of feature IDs,
   like ["F001", "F002"]; may be empty at planning time }

3. Append a NEW version entry for the version we are planning with:
   - "label": my chosen version label
   - "name": a short human-readable version name, derived from my summary (e.g.,
     “Advanced File System”)
   - "status": "planned"
   - "notes": capture the key goals, constraints, non-goals in a few sentences.
   - "features": [] // empty at this planning stage; features will be added
     later when implementation begins

4. Ensure versions.json remains valid JSON.

---

## PHASE 2 – UPDATE / CREATE PRD SECTION

Now update the Product Requirements Documentation to describe this version at a
planning level ONLY.

1. Choose the PRD file:
   - Prefer the first existing among: docs/PRD.md, docs/prd.md, PRD.md, prd.md.
   - If none exist, create docs/PRD.md.

2. In the PRD file, ADD (do not overwrite) a new section:

   ## Version [label] – [Name]

   Include:
   - Summary: 1–3 sentences based on my Q2 answer.
   - Goals:
     - Bullet list from my stated user outcomes/use cases (Q3).
   - Non-Goals:
     - Bullet list from my NON-goals (Q5).
   - Constraints:
     - Bullet list from my constraints (Q4).
   - High-Level Use Cases:
     - 3–10 user stories: “As a [type of user], I want to [do something], so
       that [value].”

3. Make clear that this section is PLANNED and not yet active for
   implementation. For example, add a line like: “Status: PLANNED (not yet
   activated for implementation).”

4. Do NOT discuss specific feature IDs in this phase; stay at a user-story /
   capability level.

---

## PHASE 3 – UPDATE / CREATE ARCHITECTURE SECTION

Describe the architectural implications of this planned version without changing
implementation details.

1. Choose the architecture file:
   - Prefer the first existing among: docs/ARCHITECTURE.md,
     docs/architecture.md, ARCHITECTURE.md, architecture.md.
   - If none exist, create docs/ARCHITECTURE.md.

2. Add a new section:

   ## Planned Architecture Impact – [Version label]

   Include bullets for:
   - New components or services that may be required.
   - Changes to existing components (at a high level).
   - Data model / schema considerations.
   - External integration ideas.
   - Performance/reliability concerns to keep in mind.

3. Clearly label this section as PLANNING ONLY, no implementation yet.

---

## PHASE 4 – OPTIONAL Claude.md / Roadmap Updates

1. If Claude.md exists:
   - Add or update a section like:

     ## Planned Version: [label] – [Name]
     - Short summary.
     - Bullet list of the main goals.
     - A note: “Implementation will only begin when a separate activation
       command is run.”

2. If a roadmap file exists (e.g., docs/roadmap.md):
   - Add a new section with the version label, summary, and key goals.
   - Mark the status as “PLANNED”.

---

## PHASE 5 – FINAL OUTPUT

When all planning updates are done, in your final response:

1. Summarize:
   - The new version label and name.
   - Its goals, non-goals, and constraints in condensed form.
   - The “status” of the version in versions.json (should be "planned").

2. List which files you created or modified:
   - versions.json
   - PRD file path
   - architecture file path
   - Claude.md (if touched)
   - roadmap (if touched)

3. Show:
   - The new versions.json entry for this version.
   - The PRD section heading and a short excerpt.
   - The architecture section heading and a short excerpt.

4. Explicitly confirm:
   - That you did NOT modify features.json.
   - That you did NOT modify package.json.
   - That no code files were modified.

Then stop. Do NOT create features, do NOT bump versions, and do NOT start
implementation.
