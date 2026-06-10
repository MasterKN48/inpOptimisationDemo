# INP Performance Sandbox & Solutions Guide

An interactive, premium React sandbox built with **Next.js (Pages Router)** and **Bun** to simulate, visualize, and test strategies for optimizing **Interaction to Next Paint (INP)**.

This sandbox acts as a playground to demonstrate how CPU-heavy tasks stall the main thread, and how to apply real-world engineering solutions to maintain a responsive user interface.

---

## 🚀 Key Sandbox Features

*   **Interactive Simulation Form**: A control panel to submit text and trigger synchronous CPU-heavy blocking loops from `0ms` to `2000ms`.
*   **Submit Button Loader**: Displays a `"Processing..."` state and spinner inside the button upon submission.
*   **Dual-Thread Spinner Monitor**:
    *   *JS (Main Thread) Spinner*: Updated via `requestAnimationFrame` on the main thread. Freezes completely during blocking tasks.
    *   *CSS (Compositor Thread) Spinner*: Animated via compositor-friendly CSS transitions. Spins smoothly in modern browsers even when JS is locked.
*   **Live INP Dashboard**: Utilizes a browser `PerformanceObserver` to capture real-time event latencies and maps them to Core Web Vital categories (Good: ≤200ms, Needs Improvement: 200-500ms, Poor: >500ms).
*   **Detailed Interaction History**: Logs past submissions with timestamp, input text, target block delay, actual processing time, and the execution mode used.

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

## 💡 INP Problems & Solutions Illustrated in This Project

Interaction to Next Paint (INP) measures the time from when a user initiates an interaction (e.g. click, keypress) to when the browser paints the next frame. The three main phases of interaction latency are:
1. **Input Delay**: Time waiting for the main thread to become free.
2. **Processing Duration**: Time spent executing JavaScript event handlers.
3. **Presentation Delay**: Time needed for the browser to recalculate styles, layout, and paint the pixels.

Here are the key INP issues demonstrated in this project, and the solutions implemented to solve them:

### Solution 1: Yielding to the Main Thread (Optimizing Processing Duration)
When long-running synchronous JavaScript occupies the main thread, the browser cannot paint any visual updates—not even initial feedback like button spinners or loading text.

*   **The Synchronous Problem**: Executing the CPU block directly inside the event handler blocks the paint. The button loader is set in React state, but it is never painted on the screen during the freeze.
*   **The setTimeout yielding technique**: Moving the heavy execution block inside `setTimeout(..., 50)` yields the main thread back to the event loop. The browser paints the button loader first (at ~16ms), and *then* processes the heavy task inside a new macrotask.
*   **The Modern `scheduler.yield()` technique**: Utilizes the modern native yielding API (with fallback) to yield execution explicitly before starting the CPU block:
    ```javascript
    async function yieldToMain() {
      if ('scheduler' in window && 'yield' in window.scheduler) {
        return await window.scheduler.yield();
      }
      return new Promise((resolve) => setTimeout(resolve, 0));
    }
    ```
    `scheduler.yield()` is superior because it pauses execution and yields to the browser's paint pipeline, resuming immediately afterwards without the arbitrary minimum delays or task-reordering downsides of `setTimeout`.

### Solution 2: Preventing Click Backlog (Optimizing Input Delay)
When a page is frozen or slow, users often click the submit button repeatedly. 

*   **The Event Queue Backlog Problem**: Although the button is marked `disabled={isSubmitting}` after the first click, subsequent clicks are still registered by the browser and queued in the OS/browser event queue. When the main thread becomes free, it processes these clicks sequentially. Because they have been sitting in the queue during the freeze, they register massive **Input Delay** latencies (e.g. 1000ms+), which severely ruins the page's overall INP score.
*   **The CSS `pointer-events: none` Solution**: When the button is in the loading/disabled state, we apply `pointer-events: none` in CSS:
    ```css
    .submitBtn:disabled {
      pointer-events: none;
    }
    ```
    This completely disables pointer hit-testing on the button. The browser ignores any clicks made while the thread is blocked, preventing the queueing of backlog events and keeping the INP metrics clean.

### Solution 3: Compositor Offloading (Optimizing Presentation Delay)
Animations driven by JavaScript (`requestAnimationFrame` or state updates) depend on main-thread event loops. If the main thread blocks, the animations freeze.

*   **Compositor Offloading Solution**: By animating elements using CSS properties like `transform` and `opacity`, modern browsers offload the animation to the **Compositor Thread**. The CSS spinner in the sandbox continues rotating smoothly even when the JS main thread spinner is completely frozen, demonstrating that offloaded animations keep the page visually responsive during heavy computation.
