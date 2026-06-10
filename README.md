# INP Performance Sandbox

A premium, interactive React sandbox built with **Next.js (Pages Router)** and **Bun** to simulate, visualize, and measure the impact of main-thread blocking on **Interaction to Next Paint (INP)**.

---

## 🚀 Key Features

*   **Interactive Simulation Form**: A clean input form where you can submit text and trigger a custom main-thread CPU-heavy block.
*   **Configurable Block Duration**: A slider allowing you to block the main thread from `0ms` up to `2000ms`.
*   **Dual-Thread Spinner Monitor**:
    *   **JS (Main Thread) Spinner**: Updated using `requestAnimationFrame` on the main thread. Freezes completely during CPU blocks.
    *   **CSS (Compositor Thread) Spinner**: Animated using CSS transforms. Continues to spin smoothly on browsers that offload transforms to the compositor thread.
*   **Live INP Measurement**: Real-time performance tracking using a browser `PerformanceObserver` to record the exact event latency.
*   **Interaction History**: A persistent session log showing the actual block latency and input configurations.
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

### How to test INP in this sandbox:
1. Open the page and notice both spinners rotating.
2. Select a block duration (e.g., `1200ms`).
3. Type a message in the input and click **Submit & Block Main Thread**.
4. **Notice the freeze**:
    *   The **JS (Main Thread)** spinner stops immediately.
    *   The **CSS (Compositor)** spinner continues moving (in most modern browsers).
5. The **INP & Latency Metrics** dashboard will update to show:
    *   **JS Processing Time**: The time spent in the synchronous loop.
    *   **Browser Event Duration**: The actual INP latency measured by the browser.
