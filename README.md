# INP Performance Sandbox & Solutions Guide

An interactive React sandbox built with **Next.js (Pages Router)** and **Bun** to simulate, visualize, and test strategies for optimizing **Interaction to Next Paint (INP)**.

---

## 🚀 Key Sandbox Features

*   **Interactive Simulation Form**: Input form to submit text and trigger CPU-heavy loops from `0ms` to `2000ms`.
*   **Simulated Keypress Block Duration**: A slider allowing you to block the main thread from `0ms` to `500ms` on every keypress during typing (`onChange`).
*   **Dual-Thread Spinner Monitor**:
    *   *JS (Main Thread) Spinner*: Updated via `requestAnimationFrame` on the main thread. Freezes completely during CPU blocks.
    *   *CSS (Compositor Thread) Spinner*: Animated via CSS transforms. Spins smoothly in modern browsers even when JS is locked.
*   **Live INP Dashboard**: Captures interaction latency in real-time (including `keydown` event timings during typing) using a browser `PerformanceObserver`.
*   **Submit Button Loader**: Displays a `"Processing..."` state and spinner inside the button upon submission.
*   **Three Execution Modes**:
    *   **Synchronous**: Blocks the main thread immediately in the event listener, preventing the loader from rendering (High INP).
    *   **Deferred (`yieldToMain` - Yields Thread)**: Yields control using `scheduler.yield()`, allowing the browser to paint the button loader first.
    *   **Deferred (Global Interceptor - Paint to Dummy Div)**: Combines a global pointerdown/keydown listener that updates an empty dummy `div` with a yield in the submit handler to ensure the visual update is painted before the block begins.
*   **Web Worker Toggle Checkbox**: Offloads the CPU-heavy computation to a background thread (Web Worker) in **any** of the selected execution modes.

---

## 💡 INP Problems & Solutions Illustrated in This Project

### 1. Controlled Inputs & Keypress Latency (The Typing INP Dilemma)

When simulating typing latency (Keypress Block Duration > 0), the performance profiles behave differently depending on the active execution mode:

1. **Synchronous Mode**:
   - The state is updated, and the blocking CPU loop runs immediately inside the `onChange` event task.
   - *Result*: severe lag while typing, character updates are visually frozen, and INP is very high (matching the block duration).

2. **Deferred Mode (`yieldToMain`)**:
   - The state is updated synchronously.
   - We yield to the event loop using `await yieldToMain()`, then run the blocking loop.
   - *Result*: Because yielding only schedules a macro task which often runs *before* the next VSync paint (paint throttling) and subsequent keypresses accumulate queueing delays, typing remains laggy with a high INP score.

3. **Optimized (Debounced) Mode**:
   - The state is updated synchronously.
   - The heavy CPU block is **debounced** using a timer ref.
   - If the user types a new character before the debounce timer (e.g., 250ms) finishes, the previous scheduled block is canceled.
   - *Result*: Typing is completely fluid and responsive, characters render instantly (< 16ms), and INP remains low. Once the user stops typing, the CPU block is safely executed.

---

### 2. Yielding to the Main Thread (Optimizing Processing Duration)
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
      const handleGlobalInteraction = () => {
        if (executionMode === "intercept") {
          setDummyTick((prev) => prev + 1); // Toggles state of dummy element
        }
      };
      window.addEventListener("pointerdown", handleGlobalInteraction, true);
      return () => {
        window.removeEventListener("pointerdown", handleGlobalInteraction, true);
      };
    }, [executionMode]);
    ```
2.  **Dummy Paint Target**: An empty off-screen `div` has its opacity toggled by `dummyTick`, prompting the browser to schedule a repaint:
    ```html
    <div id="dummy-paint-target" style={{ opacity: dummyTick % 2 === 0 ? 0.99 : 1, width: "1px", height: "1px", position: "absolute", left: "-9999px" }}></div>
    ```
3.  **Submission Yielding**: Inside `handleSubmit`, we yield control before the heavy CPU block starts.

---

## ⚡ Web Worker: The Ultimate INP Solution

Offloading CPU-intensive loops to a **Web Worker** runs them on a separate thread, keeping the main thread completely free.

*   **Impact**: When **Web Worker** is enabled, it works in combination with all three modes. Since the computation is backgrounded, the main thread never blocks, resulting in **fluid spinner animations** and a **perfect INP score (< 20ms)** regardless of where or when you click on the page.

---

## 🛠️ Getting Started

### 1. Installation
```bash
bun install
```

### 2. Run the Development Server
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000).
