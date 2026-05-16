---
estimated_steps: 7
estimated_files: 1
skills_used: []
---

# T01: Add timer auto-stop with configurable max hours

Why: Freelancer forgets timer running overnight, corrupting hours data (R009). The timer ticks via setInterval in log-timer-button.tsx but has no upper bound.

Do:
1. In log-timer-button.tsx, read max hours from localStorage key 'timer_max_hours' (default 8) on mount via a ref.
2. In the useEffect tick callback, after incrementing seconds, check if seconds >= maxSeconds. If so, call handleStop() and fire toast.warning('Timer parou automaticamente após Xh').
3. Use a ref (secondsRef) to track accumulated seconds to avoid stale closure issues with handleStop. The setInterval callback updates both state and ref.
4. Guard against double-stop by checking active state before calling handleStop.

Done when: Timer auto-stops at configured limit and shows warning toast. Default 8h works without any settings change.

## Inputs

- `src/app/(app)/logs/log-timer-button.tsx`

## Expected Output

- `src/app/(app)/logs/log-timer-button.tsx`

## Verification

npx tsc --noEmit
