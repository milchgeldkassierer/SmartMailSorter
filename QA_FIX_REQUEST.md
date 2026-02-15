# QA Fix Request

**Status**: REJECTED
**Date**: 2026-02-15T12:33:45Z
**QA Session**: 1

## Critical Issues to Fix

### 1. Missing Required Prop in Existing Test Cases

**Problem**: When `onToggleFlag` was added as a required prop to `UseBatchOperationsProps`, 9 existing test cases for other batch operations (handleBatchMarkRead, handleBatchDelete, handleBatchSmartSort) were not updated to include this new required prop. This causes TypeScript compilation to fail.

**Location**: `src/hooks/__tests__/useBatchOperations.test.ts`

**Affected Test Cases** (9 total):
1. Line 59: "should return handleBatchMarkRead function"
2. Line 84: "should mark all as read when any selected email is unread"
3. Line 117: "should mark all as unread when all selected emails are read"
4. Line 150: "should only toggle emails whose state differs from target"
5. Line 182: "should clear selection after successful batch mark read"
6. Line 210: "should display error alert on failure"
7. Line 237: "should do nothing when selectedIds is empty"
8. Line 267: "should handle mixed read/unread selection correctly"
9. Line 301: "should not clear selection on failure"

**Required Fix**: Add `onToggleFlag: vi.fn()` to each test case's props object.

**Example**:
```typescript
// In each affected test case, add the onToggleFlag line:
const { result } = renderHook(() =>
  useBatchOperations({
    selectedIds: new Set(),
    currentEmails: [],
    currentCategories: [],
    aiSettings: defaultAISettings,
    onDeleteEmail: vi.fn(),
    onToggleRead: vi.fn(),
    onToggleFlag: vi.fn(),  // <-- ADD THIS LINE to all 9 test cases
    onClearSelection: vi.fn(),
    onUpdateEmails: vi.fn(),
    onUpdateCategories: vi.fn(),
    onOpenSettings: vi.fn(),
  })
);
```

**Why This Matters**:
- TypeScript compilation fails, preventing deployment
- While vitest tests pass at runtime, strict type checking fails
- Production builds with TypeScript checking enabled will fail

**Verification Steps**:
1. Add `onToggleFlag: vi.fn()` to all 9 test cases listed above
2. Run `npx tsc --noEmit` and verify no TypeScript errors in useBatchOperations.test.ts
3. Run `npm test` and verify all tests still pass (should be 620+ tests passing)
4. Commit the fix with message: "fix: add missing onToggleFlag prop to existing batch operation tests (qa-requested)"

## After Fixes

Once fixes are complete:

1. **Commit** with the message format:
   ```
   fix: add missing onToggleFlag prop to existing batch operation tests (qa-requested)
   ```

2. **QA will automatically re-run** and complete:
   - TypeScript type checking verification
   - Visual UI verification (checking button appearance, labels, functionality)
   - Final sign-off

3. **Expected outcome**: All checks pass, visual verification confirms UI works correctly, QA approves

## Notes

- The implementation itself is excellent and follows patterns correctly
- This is a simple oversight that occurs when adding required props
- The fix is straightforward: add one line to 9 test cases
- Estimated time to fix: 5 minutes
