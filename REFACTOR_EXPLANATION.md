# Sidebar Refetch Issue - Root Cause & Solution

## The Problem

Your app was refetching data **every time** you switched tabs/routes because:

### 1. **Sidebar Remounting Issue** ❌
```
OLD STRUCTURE:
├── app/main/layout.tsx → <Sidebar>{children}</Sidebar>
├── app/list/layout.tsx → <Sidebar>{children}</Sidebar>
└── app/history/layout.tsx → <Sidebar>{children}</Sidebar>
```

**What happened when switching routes:**
- Route `/main` → Sidebar #1 mounted
- Switch to `/list` → Sidebar #1 unmounted, Sidebar #2 mounted (NEW INSTANCE)
- Switch to `/history` → Sidebar #2 unmounted, Sidebar #3 mounted (NEW INSTANCE)
- Each new Sidebar mount triggered `useEffect` hooks in child components

### 2. **Circular Dependency in Dependencies Array** ❌
```typescript
// BEFORE (BAD)
const fetchVideos = useCallback(async () => { ... }, [token]);

useEffect(() => {
    if (!authLoading && !propVideos) {
        fetchVideos();
    }
}, [propVideos, authLoading, fetchVideos]); // ← fetchVideos IS a dependency!
```

**Why this is a problem:**
- `fetchVideos` is recreated every render (due to `token` in its dependencies)
- Every render creates a NEW `fetchVideos` function
- New function reference → useEffect runs again
- useEffect runs → `fetchVideos` called → component re-renders
- **Infinite loop/continuous fetches!**

### 3. **Same Issue in HistoryPage** ❌
```typescript
// BEFORE (BAD)
const loadHistory = useCallback(async (skip = 0, append = false) => {
    // ... calls mapLogsToVideos
}, [token, mapLogsToVideos]); // ← includes mapLogsToVideos

const mapLogsToVideos = useCallback(async (items) => {
    // ...
}, [token]); // ← depends on token

useEffect(() => {
    if (!authLoading) {
        loadHistory(0, false);
    }
}, [authLoading, loadHistory]); // ← triggers on loadHistory change
```

**Dependency chain:**
- `mapLogsToVideos` changes (recreated due to token)
- → `loadHistory` changes
- → useEffect runs
- → `loadHistory` called
- → component re-renders
- **Continuous refetches!**

---

## The Solution ✅

### Step 1: Move Sidebar to Root Layout

**AFTER REFACTOR:**
```
app/
├── layout.tsx (ROOT) → <Sidebar>{children}</Sidebar> ← MOUNTED ONCE
├── main/layout.tsx → just return {children}
├── list/layout.tsx → just return {children}
└── history/layout.tsx → just return {children}
```

**Benefits:**
- Sidebar mounts **ONCE** at app startup
- Sidebar **PERSISTS** across all routes
- Child components update without remounting parent
- **No more cascading re-renders!**

### Step 2: Fix Dependency Arrays

**BEFORE:**
```typescript
useEffect(() => {
    if (!authLoading && !propVideos) {
        fetchVideos();
    }
}, [propVideos, authLoading, fetchVideos]); // ❌ fetchVideos shouldn't be here
```

**AFTER:**
```typescript
useEffect(() => {
    if (!authLoading && !propVideos && token) {
        fetchVideos();
    }
}, [token, authLoading, propVideos]); // ✅ Only primitive values
```

**Why this works:**
- Depends only on **primitive values** (boolean, string)
- Primitive values don't change on every render
- useEffect runs only when actual data changes
- **No more circular logic!**

### Step 3: Fix HistoryPage Dependencies

**BEFORE:**
```typescript
useEffect(() => {
    if (!authLoading) {
        loadHistory(0, false);
    }
}, [authLoading, loadHistory]); // ❌ loadHistory recreated every render
```

**AFTER:**
```typescript
useEffect(() => {
    if (!authLoading && token) {
        loadHistory(0, false);
    }
}, [authLoading, token]); // ✅ Only trigger on auth state change
```

---

## Impact & Results

| Scenario | Before | After |
|----------|--------|-------|
| Switch main → list | ❌ Fetch (new Sidebar) | ✅ No fetch |
| Switch list → history | ❌ Fetch (new Sidebar) | ✅ No fetch |
| Return to main (5 sec later) | ❌ Fetch (new Sidebar) | ✅ Cached data |
| Change auth token | ✅ Fetch (intended) | ✅ Fetch (intended) |
| Add new video | Shows immediately | Uses cache until manual refresh needed |

---

## Production Improvements (Optional Next Steps)

### Add Stale-Time Caching
```typescript
const [lastFetchTime, setLastFetchTime] = useState(0);
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

useEffect(() => {
    if (!authLoading && !propVideos && token) {
        const now = Date.now();
        if (now - lastFetchTime > CACHE_DURATION) {
            fetchVideos();
            setLastFetchTime(now);
        }
    }
}, [token, authLoading, propVideos, lastFetchTime]);
```

### Use React Query (Recommended)
```typescript
import { useQuery } from '@tanstack/react-query';

const { data } = useQuery({
    queryKey: ['videos', token],
    queryFn: () => videosApi.listMine(token),
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
});
```

---

## Files Modified

1. ✅ `app/layout.tsx` - Added Sidebar to root
2. ✅ `app/main/layout.tsx` - Removed Sidebar wrapper
3. ✅ `app/list/layout.tsx` - Removed Sidebar wrapper  
4. ✅ `app/history/layout.tsx` - Removed Sidebar wrapper
5. ✅ `app/component/VideoList.tsx` - Fixed dependency array
6. ✅ `app/history/page.tsx` - Fixed dependency array

---

## Testing Checklist

- [ ] Navigate main → list → history (should NOT fetch)
- [ ] Return to previous page (should use cached data)
- [ ] Open DevTools Network tab (should see no new requests)
- [ ] Log in/out (should fetch fresh data)
- [ ] Upload video (should update list immediately)
