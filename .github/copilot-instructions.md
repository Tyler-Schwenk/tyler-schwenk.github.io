# GitHub Copilot Instructions - Instinct Environmental

## Project Overview
Personal website for all my fun things.

The resources in C:\Users\tyler\important\projects\WebDev\Tylers Website\tyler-schwenk.github.io\docs are authoritative and must be referenced before making changes.  
They must also be kept up to date as changes are made.

- docs/
  - Contains all project documentation, organized into subfolders
  - You may reorganize or improve documentation structure as needed
  - Documentation must reflect the current system behavior and data formats
- In-code docstrings
  - Must always be accurate and up to date
  - Treated as first-class documentation for future AI code companions

---

## Global Coding Rules (MANDATORY)

All code must comply with the following rules without exception:

1. Use clear, well-structured code that prioritizes readability, reuse, and correctness.
2. Avoid deep nesting:
   - Maximum of 3 indentation levels in most cases
   - Prefer early returns, helper functions, or refactoring over nesting
3. No magic numbers.
   - All constants must be named and centralized
4. No emojis anywhere in code, logs, comments, or documentation.
6. Reuse existing code whenever possible.
   - Reduce duplication
   - Fewer lines are acceptable only if clarity and maintainability are preserved
7. Optimize for long-term maintainability and readability.
8. Do not document change history or current changes and issues.
   - Only document how the system works today
   - Focus on data formats, schemas, APIs, and behavior
9. When modifying a file:
   - You must read the entire file
   - Ensure no compile, runtime, or logical errors are introduced
10. All functions and classes must have docstrings.
    - Follow PEP 257 conventions
    - Google or NumPy style is acceptable
    - Docstrings must describe:
      - Purpose
      - Inputs
      - Outputs
      - Side effects (if any)

## JSDoc Standards

**REQUIRED for all:**
- Service functions (all exports in `src/services/`)
- Custom hooks (all exports in `src/hooks/`)
- Utility functions (all exports in `src/utils/`)
- Context providers and hooks
- Component exports (especially reusable ones)

**JSDoc Format:**
```javascript
/**
 * Brief description of what the function does
 * @param {Type} paramName - Parameter description
 * @param {Object} options - Options object (if applicable)
 * @param {string} options.key - Nested property description
 * @returns {Promise<{data: Type|null, error: string|null}>} Description of return value
 */
export const functionName = async (paramName, options) => {
```

**Service Layer Pattern:**
All service functions MUST document the `{data, error}` return pattern:
```javascript
/**
 * @returns {Promise<{data: Array|null, error: string|null}>} Sensor data or error
 */
```

**Hook Pattern:**
```javascript
/**
 * Custom hook for managing state
 * @param {string} userId - User ID
 * @returns {{data: Array, loading: boolean, error: string|null}}
 */
```

**When to update JSDoc:**
- Adding new parameters to existing functions
- Changing return types
- Adding new exported functions
- Modifying function behavior significantly

See `docs/JSDOC_GUIDE.md` for examples and patterns.

## After Making Code Changes - MANDATORY VERIFICATION

**You MUST perform these checks after ANY file modifications:**

1. **Run get_errors** on ALL changed files
2. **Read the entire modified file** to verify:
   - No bracket/brace mismatches (count opening vs closing `{`, `}`, `(`, `)`, `[`, `]`)
   - No orphaned code fragments from incomplete replacements
   - No merge artifacts (two functions accidentally merged)
   - No syntax errors (typos like `or` instead of `for`)
   - All try blocks have catch/finally
   - All loops properly closed
   - No corrupted lines from partial replacements (e.g., `getTimeSince(timestamp)nds`)
   - No duplicate function definitions or code blocks

3. **If using replace_string_in_file multiple times:**
   - Read the full file after ALL replacements complete
   - Check for leftover code that should've been removed
   - Verify function boundaries are intact
   - Ensure imports/exports are not duplicated

**Common errors from incomplete replacements:**
- Extra closing brackets where old code wasn't fully removed
- Function definitions merged together
- Partial lines mixing old and new code
- Orphaned code blocks between functions

**Never mark a task complete until verification passes.**

## Coding Standards

### Cloud Functions
- Use **modular architecture** - separate handlers, services, and utils
- Never use emojis
- **Structured logging** with Logger class (see `utils/logger.js`)
- **Error handling**: Always catch and log errors with context
- **Async/await**: Use modern async patterns, avoid callbacks
- **Parallel execution**: Use `Promise.all()` for independent operations

### Firestore Paths
- Organizations: `orgs/{orgId}`
- Sensor data: `orgs/{orgId}/clusters/{clusterId}/sensors/{sensorId}/data/{timestamp}`
- **Subscriptions**: `users/{userId}/subscriptions/{subscriptionId}` (with `orgIds` array field)
- See `docs/DATABASE.md` for complete schema


## Critical Notes
- **PowerShell**: Always quote comma-separated lists: `--only "hosting,functions"`
- **Firestore triggers**: Use Gen2 functions with `onDocumentCreated` (not legacy v1 triggers)
- **Secrets**: Managed via Google Secret Manager (SENDGRID_API_KEY, TWILIO_SID, etc.)
- **Region**: Functions in `us-central1`, Firestore in `nam5`

## When Making Changes
1. **Read docs first**: Check `docs/` for any relevant documentation
2. **Test locally**: Use emulators or test scripts before deploying
3. **Update docs**: Keep `docs/` in sync with code changes
4. **Log everything**: Use Logger class with appropriate context
5. **Handle errors**: Graceful degradation, never throw unhandled errors

## Code Review Checklist
- [ ] Follows modular architecture (handlers → services → utils)
- [ ] Uses Logger for all significant events (Cloud Functions)
- [ ] Handles errors gracefully with context
- [ ] Parallel execution where possible
- [ ] **JSDoc comments on all exported functions**
- [ ] Documentation updated if schema/API changed
- [ ] Tested with scripts or emulator
