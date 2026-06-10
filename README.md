# INP Performance Sandbox

A premium, interactive React sandbox built with **Next.js (Pages Router)** and **Bun** to simulate, visualize, and measure the impact of main-thread blocking on **Interaction to Next Paint (INP)**.

---

## 🚀 Key Features

*   **Interactive Simulation Form**: A clean input form where you can submit text and trigger a custom main-thread CPU-heavy block.
*   **Submit Button Loader**: Displays a `"Processing..."` state and rotating loader (`.btnSpinner`) inside the button upon click, returning to its default state after execution is completed.
*   **Disabled State Optimization**: Employs `pointer-events: none` on the disabled button. This resolves the event backlog/input delay problem where clicks queued up while the thread was busy trigger additional high INP timings when the thread yields.
*   **Three Execution Modes**:
    *   **Synchronous**: Blocks the main thread immediately in the event listener. The browser cannot paint the button loader until the block finishes (the loader stays invisible).
    *   **Deferred (setTimeout)**: Yields control using a standard macrotask (`setTimeout`), letting the browser paint the button loader first before the CPU block begins.
    *   **Deferred (scheduler.yield)**: Yields control using the modern Web API `scheduler.yield()` with a fallback to `setTimeout(resolve, 0)`, allowing progressive rendering and immediate task scheduling.
*   **Configurable Block Duration**: A slider allowing you to block the main thread from `0ms` up to `2000ms`.
*   **Dual-Thread Spinner Monitor**:
    *   **JS (Main Thread) Spinner**: Updated using `requestAnimationFrame` on the main thread. Freezes completely during CPU blocks.
    *   **CSS (Compositor Thread) Spinner**: Animated using CSS transforms. Continues to spin smoothly on browsers that offload transforms to the compositor thread.
*   **Live INP Measurement**: Real-time performance tracking using a browser `PerformanceObserver` to record the exact event latency.
*   **Interaction History**: A persistent session log showing the actual block latency, execution mode, and input configurations.
*   **Custom Dark CSS System**: Fully hand-crafted modern UI with glassmorphic cards and color-coded score category feedback (Good: ≤200ms, Needs Improvement: 200ms - 500ms, Poor: >500ms).

---

## 🛠️ Getting Started

### 1. Installation
Install project dependencies using Bun:
```bash
bun install
```

### 2. Run the Development Server
Launch the Next.js development server:
```bash
bun run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📊 Understanding Interaction to Next Paint (INP)

**INP (Interaction to Next Paint)** is a Core Web Vital that measures page responsiveness. It calculates the latency of all user interactions (clicks, keypresses, taps) on a page and records the maximum duration until the browser is able to paint the next frame.

### Testing and Comparing the Execution Modes:

1.  **Synchronous Mode (High INP)**:
    *   Set **Execution Mode** to *Synchronous*.
    *   Set duration to `1500ms` and click **Submit**.
    *   **Observation**: The button loader never appears because the thread is blocked during the interaction before a paint can occur. The browser registers a very high INP (~1500ms).
2.  **Deferred Mode (setTimeout)**:
    *   Set **Execution Mode** to *Deferred (setTimeout - Yields Thread)*.
    *   Set duration to `1500ms` and click **Submit**.
    *   **Observation**: The button immediately displays the loader, and the main thread is blocked shortly after, allowing visual feedback to render first.
3.  **Modern Deferred Mode (scheduler.yield)**:
    *   Set **Execution Mode** to *Deferred (scheduler.yield() - Modern Yield)*.
    *   Set duration to `1500ms` and click **Submit**.
    *   **Observation**: The button immediately displays the loader. It utilizes the modern `scheduler.yield()` API to yield control back to the event loop, prioritizing painting before completing the CPU task.

### Why does clicking a disabled button during a freeze cause high INP?
When a button triggers a heavy synchronous CPU block, clicking it multiple times causes the browser to queue these pointer events. Although the button becomes `disabled` after the first click in React state, the browser's event queue processes the queued clicks *after* the thread becomes free. 

The latency is measured from the user's click time (input timestamp) to the next painted frame. Since these click attempts occurred during the block, they experience massive **input delay**, yielding a very high INP score even though React doesn't run any code for them.

Applying `pointer-events: none` on the button while it is disabled stops the browser from targeting it for click events, completely eliminating this event queue backlog and keeping the INP score accurate!
