You are my INITIALIZATION AGENT.

1. Create Claude.md summarizing:
   - project overview
   - stack
   - constraints
   - testing workflow
   - commit conventions
   - instructions for Cursor to always follow rules in `.cursor/rules`

2. Generate features.json containing:
   - 10–25 small, testable features
   - each with: id, title, description, tests[], implemented=false,
     tests_passed=false

3. Create an initial progress.md with a header and note that no features are
   implemented yet.

4. Ensure package.json contains:
   - npm test script
   - npm run test:e2e script
   - testing libraries installed if needed

5. Display the resulting files for approval.
