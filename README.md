# INP Performance Sandbox & Solutions Guide

An interactive React sandbox built with **Next.js (Pages Router)** and **Bun** to simulate, visualize, and test strategies for optimizing **Interaction to Next Paint (INP)**.

---

## 🚀 Key Sandbox Features

*   **Interactive Simulation Form**: Input form to submit text and trigger CPU-heavy loops from `0ms` to `2000ms`.
*   **Dual-Thread Spinner Monitor**:
    *   *JS (Main Thread) Spinner*: Updated via `requestAnimationFrame` on the main thread. Freezes completely during CPU blocks.
    *   *CSS (Compositor Thread) Spinner*: Animated via CSS transforms. Spins smoothly in modern browsers even when JS is locked.
*   **Live INP Dashboard**: Captures interaction latency in real-time using a browser `PerformanceObserver`.
*   **Submit Button Loader**: Displays a `"Processing..."` state and spinner inside the button upon submission.
*   **Three Execution Modes**:
    *   **Synchronous**: Blocks the main thread immediately in the event listener, preventing the loader from rendering (High INP).
    *   **Deferred (`yieldToMain` - Yields Thread)**: Yields control using `scheduler.yield()`, allowing the browser to paint the button loader first.
    *   **Deferred (Global Interceptor - Paint to Dummy Div)**: Combines a global pointerdown listener that updates an empty dummy `div` with a yield in the submit handler to ensure the visual update is painted before the block begins.

---

## 💡 INP Problems & Solutions Illustrated in This Project

### 1. Yielding to the Main Thread (Optimizing Processing Duration)
When long-running synchronous JavaScript occupies the main thread, the browser cannot paint any visual updates—not even initial feedback like button spinners or loading text.

*   **Synchronous Mode (High INP)**: Executing the CPU block directly inside the event handler blocks the paint. The button loader is set in React state, but it is never painted on the screen during the freeze.
*   **Deferred Mode (`yieldToMain` - Modern Yield)**: Utilizes the modern native yielding API (with fallback) to yield execution explicitly before starting the CPU block:
    ```javascript
    async function yieldToMain() {
      if ('scheduler' in window && 'yield' in window.scheduler) {
        return await window.scheduler.yield();
      }
      return new Promise((resolve) => setTimeout(resolve, 0));
    }
    ```
    This yields control back to the event loop, prioritizing the browser's painting pipeline (so the button loader renders instantly) before proceeding with the CPU-heavy block.

---

## 🔬 Experimental Mode: Global Click Interceptor & Dummy Paint Target

In this mode, we split event capturing and yielding across two places:

1.  **Global Click Listener**: A capture-phase listener is added to `window` for `pointerdown` events:
    ```javascript
    useEffect(() => {
      const handleGlobalClick = () => {
        if (executionMode === "intercept") {
          setDummyTick((prev) => prev + 1); // Toggles state of dummy element
        }
      };
      window.addEventListener("pointerdown", handleGlobalClick, true);
      ...
    }, [executionMode]);
    ```
2.  **Dummy Paint Target**: An empty off-screen `div` has its opacity toggled by `dummyTick`, prompting the browser to schedule a repaint:
    ```html
    <div id="dummy-paint-target" style={{ opacity: dummyTick % 2 === 0 ? 0.99 : 1, width: "1px", height: "1px", position: "absolute", left: "-9999px" }}></div>
    ```
3.  **Submission Yielding**: Inside `handleSubmit`, we yield control before the heavy CPU block starts:
    ```javascript
    } else {
      // Global Interceptor mode
      await yieldToMain();
      setIsSubmitting(true);
      setIsBlocked(true);
      const actualDuration = simulateHeavyComputation(blockDuration);
      ...
    }
    ```

### How it Behaves:
*   **For the Submit Button Click**:
    When the submit button is clicked, the global `pointerdown` listener fires first and triggers the state change on the dummy div. Then, `handleSubmit` runs and immediately calls `await yieldToMain()`. This yields control back to the browser's paint pipeline, allowing the browser to paint BOTH the dummy div update and the button loading state. The interaction latency for the click remains very low (green/good INP).
*   **For Clicks Anywhere Else (During the Block)**:
    Since the CPU block itself is still synchronous, the main thread is frozen once the block starts. Any clicks made elsewhere on the screen while the thread is frozen will still experience a high input delay (as the event queue is blocked), resulting in a high INP score for those subsequent clicks.
