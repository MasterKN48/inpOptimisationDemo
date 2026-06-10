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
*   **Execution Mode Selector**: Allows choosing between synchronous execution and deferred execution yielding to the main thread.

---

## 💡 INP Problems & Solutions Illustrated in This Project

### Yielding to the Main Thread (Optimizing Processing Duration)
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
