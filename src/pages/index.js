import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import styles from "@/styles/Home.module.css";

async function yieldToMain() {
  if (
    typeof window !== "undefined" &&
    "scheduler" in window &&
    "yield" in window.scheduler
  ) {
    return await window.scheduler.yield();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function runInWorker(duration) {
  return new Promise((resolve) => {
    const workerCode = `
      self.onmessage = function(e) {
        const duration = e.data;
        const start = performance.now();
        let count = 0;
        while (performance.now() - start < duration) {
          count += Math.random() * Math.random();
        }
        self.postMessage(Math.round(performance.now() - start));
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e) => {
      resolve(e.data);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    worker.postMessage(duration);
  });
}

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [blockDuration, setBlockDuration] = useState(1000); // 1s default
  const [isBlocked, setIsBlocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionMode, setExecutionMode] = useState("sync"); // "sync", "yield", or "intercept"
  const [lastInp, setLastInp] = useState(0);
  const [jsDuration, setJsDuration] = useState(0);
  const [history, setHistory] = useState([]);
  const [dummyTick, setDummyTick] = useState(0);
  const [useWorker, setUseWorker] = useState(false);
  const [inputDelay, setInputDelay] = useState(0); // 0ms default keypress delay
  const typingTimeoutRef = useRef(null);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Global click detector (dummy paint interceptor experiment)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleGlobalInteraction = () => {
      if (executionMode === "intercept") {
        // Force a visual paint on the dummy div by toggling its style
        setDummyTick((prev) => prev + 1);
      }
    };

    window.addEventListener("pointerdown", handleGlobalInteraction, true);
    return () => {
      window.removeEventListener("pointerdown", handleGlobalInteraction, true);
    };
  }, [executionMode]);

  const jsSpinnerRef = useRef(null);

  // JS-driven spinner loop to animate using requestAnimationFrame (Main Thread)
  useEffect(() => {
    let angle = 0;
    let frameId;

    const animate = () => {
      angle = (angle + 4) % 360;
      if (jsSpinnerRef.current) {
        jsSpinnerRef.current.style.transform = `rotate(${angle}deg)`;
      }
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // PerformanceObserver to capture interaction latency (INP)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let observer;
    try {
      observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          // Capture user interactions
          if (
            ["click", "pointerdown", "mousedown", "keydown"].includes(
              entry.name,
            )
          ) {
            setLastInp(Math.round(entry.duration));
          }
        }
      });
      // Observe event timings
      observer.observe({ type: "event", buffered: true });
    } catch (e) {
      console.warn("PerformanceObserver not supported in this browser:", e);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, []);

  // Synchronous main thread blocking function
  const simulateHeavyComputation = (duration) => {
    const start = performance.now();
    let count = 0;
    // Loop synchronously to block the event loop
    while (performance.now() - start < duration) {
      count += Math.random() * Math.random();
    }
    return Math.round(performance.now() - start);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const start = performance.now();
    let processingTime = 0;

    if (executionMode === "sync") {
      setIsSubmitting(true);
      setIsBlocked(true);
      if (useWorker) {
        processingTime = await runInWorker(blockDuration);
      } else {
        // Synchronous block: executes immediately in the event task, freezing paint
        const actualDuration = simulateHeavyComputation(blockDuration);
        const end = performance.now();
        processingTime = Math.round(end - start);
      }
    } else if (executionMode === "yield") {
      setIsSubmitting(true);
      setIsBlocked(true);
      // Yield to let the browser paint the button loader first, then run CPU block
      await yieldToMain();
      if (useWorker) {
        processingTime = await runInWorker(blockDuration);
      } else {
        const actualDuration = simulateHeavyComputation(blockDuration);
        const end = performance.now();
        processingTime = Math.round(end - start);
      }
    } else {
      // Global Interceptor mode: executes synchronously in submit method (per request)
      await yieldToMain();
      setIsSubmitting(true);
      setIsBlocked(true);
      if (useWorker) {
        processingTime = await runInWorker(blockDuration);
      } else {
        const actualDuration = simulateHeavyComputation(blockDuration);
        const end = performance.now();
        processingTime = Math.round(end - start);
      }
    }

    setJsDuration(processingTime);
    setIsBlocked(false);
    setIsSubmitting(false);

    // Add to history
    const timestamp = new Date().toLocaleTimeString();
    setHistory((prev) => [
      {
        id: Date.now(),
        inputValue: inputValue || "(empty)",
        configuredDuration: blockDuration,
        jsDuration: processingTime,
        mode: `${
          executionMode === "sync"
            ? "Synchronous"
            : executionMode === "yield"
              ? "Deferred (yieldToMain)"
              : "Global Intercept"
        }${useWorker ? " + Web Worker" : ""}`,
        timestamp,
      },
      ...prev.slice(0, 9), // limit to last 10 entries
    ]);
  };

  // Determine INP Score Category
  // INP: <= 200ms (Good), 200-500ms (Needs Improvement), > 500ms (Poor)
  const getInpCategory = (duration) => {
    if (duration === 0) return { label: "N/A", class: "" };
    if (duration <= 200)
      return {
        label: "Good",
        class: styles.badgeGood,
        fillClass: styles.fillGood,
        textClass: styles.textGood,
      };
    if (duration <= 500)
      return {
        label: "Needs Improvement",
        class: styles.badgeNeedsImprovement,
        fillClass: styles.fillNeedsImprovement,
        textClass: styles.textNeedsImprovement,
      };
    return {
      label: "Poor",
      class: styles.badgePoor,
      fillClass: styles.fillPoor,
      textClass: styles.textPoor,
    };
  };

  const inpCategory = getInpCategory(lastInp || jsDuration); // Fallback to JS duration if INP observer has not fired yet
  const displayLatency = lastInp || jsDuration;

  // Calculate percentage for progress bar (max out at 2000ms)
  const fillPercentage = Math.min((displayLatency / 2000) * 100, 100);

  return (
    <>
      <Head>
        <title>INP Performance Sandbox</title>
        <meta
          name="description"
          content="Simulate and measure Interaction to Next Paint (INP) with main thread blocking"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>INP Performance Sandbox</h1>
          <p className={styles.subtitle}>
            A space to test how synchronous CPU operations block the main thread
            and impact **Interaction to Next Paint (INP)**.
          </p>
        </header>

        <main className={styles.dashboardGrid}>
          {/* Left Column: Control Panel and Form */}
          <section className={`${styles.panel} glass-panel`}>
            <div>
              <h2 className={styles.sectionTitle}>Interactive Form</h2>
              <p className={styles.cardDescription}>
                Submit this form to trigger a heavy CPU block. Adjust the slider
                to increase/decrease the simulated block duration.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="text-input">
                  Sample Input Text
                </label>
                <input
                  id="text-input"
                  type="text"
                  className={styles.formInput}
                  placeholder="Type something..."
                  value={inputValue}
                  onChange={async (e) => {
                    const newValue = e.target.value;

                    // 1. Update state synchronously so the value prints immediately
                    setInputValue(newValue);

                    // Clear any scheduled CPU block from the previous keystroke
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                      typingTimeoutRef.current = null;
                    }

                    if (inputDelay <= 0) return;

                    if (executionMode === "sync") {
                      // Synchronous mode: block immediately (causes lag and high INP)
                      simulateHeavyComputation(inputDelay);
                    } else if (executionMode === "yield") {
                      // Yield mode: yield but run block on every keystroke
                      await yieldToMain();
                      simulateHeavyComputation(inputDelay);
                    } else {
                      // Optimized (Debounced) mode: Debounce the heavy block so active typing is smooth
                      typingTimeoutRef.current = setTimeout(() => {
                        simulateHeavyComputation(inputDelay);
                      }, 250); // 250ms debounce delay
                    }
                  }}
                />
              </div>

              <div className={styles.formGroup}>
                <label
                  className={styles.formLabel}
                  htmlFor="input-delay-slider"
                >
                  Simulated Keypress Block Duration (onChange)
                </label>
                <div className={styles.rangeGroup}>
                  <input
                    id="input-delay-slider"
                    type="range"
                    min="0"
                    max="500"
                    step="50"
                    className={styles.formRange}
                    value={inputDelay}
                    onChange={(e) => setInputDelay(Number(e.target.value))}
                  />
                  <span className={styles.rangeValue}>{inputDelay} ms</span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="delay-slider">
                  Simulated CPU Block Duration (Form Submit)
                </label>
                <div className={styles.rangeGroup}>
                  <input
                    id="delay-slider"
                    type="range"
                    min="0"
                    max="2000"
                    step="100"
                    className={styles.formRange}
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(Number(e.target.value))}
                  />
                  <span className={styles.rangeValue}>{blockDuration} ms</span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="mode-select">
                  Execution Mode
                </label>
                <select
                  id="mode-select"
                  className={styles.formInput}
                  value={executionMode}
                  onChange={(e) => setExecutionMode(e.target.value)}
                >
                  <option value="sync">
                    Synchronous (High INP - Loader Blocked)
                  </option>
                  <option value="yield">
                    Deferred (yieldToMain - Yields Thread)
                  </option>
                  <option value="intercept">
                    Deferred (Global Interceptor - Paint to Dummy Div)
                  </option>
                </select>
              </div>

              <div
                className={styles.formGroup}
                style={{
                  flexDirection: "row",
                  gap: "0.5rem",
                  alignItems: "center",
                  marginTop: "1rem",
                  marginBottom: "0.5rem",
                }}
              >
                <input
                  id="worker-checkbox"
                  type="checkbox"
                  checked={useWorker}
                  onChange={(e) => setUseWorker(e.target.checked)}
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "var(--color-primary)",
                    cursor: "pointer",
                  }}
                />
                <label
                  className={styles.formLabel}
                  htmlFor="worker-checkbox"
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  Offload Heavy Task to Web Worker (Zero Main Thread Block)
                </label>
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting && <span className={styles.btnSpinner}></span>}
                {isSubmitting ? "Processing..." : "Submit & Start CPU Work"}
              </button>
            </form>
          </section>

          {/* Right Column: Monitors and Metrics */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
          >
            {/* Thread State Monitor */}
            <section
              className={`${styles.panel} ${styles.monitorBox} glass-panel`}
            >
              <h2 className={styles.sectionTitle}>Main Thread Monitor</h2>

              <div
                style={{ display: "flex", gap: "2rem", alignItems: "center" }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      marginBottom: "0.5rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    JS (Main Thread)
                  </p>
                  <div className={styles.spinnerContainer}>
                    <div ref={jsSpinnerRef} className={styles.outerSpinner} />
                    <div
                      className={styles.innerSpinner}
                      style={{ animation: "none" }}
                    />{" "}
                    {/* JS loop controls this container */}
                  </div>
                </div>

                <div>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      marginBottom: "0.5rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    CSS (Compositor)
                  </p>
                  <div className={styles.spinnerContainer}>
                    <div
                      className={`${styles.outerSpinner} animate-spin-slow`}
                    />
                    <div className={styles.innerSpinner} />
                  </div>
                </div>
              </div>

              <div>
                <p className={styles.threadStatusText}>
                  Status:{" "}
                  {isBlocked ? (
                    <span className={styles.threadBlocked}>BLOCKED</span>
                  ) : (
                    <span className={styles.threadActive}>
                      ACTIVE (RUNNING)
                    </span>
                  )}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    marginTop: "0.5rem",
                  }}
                >
                  Note: The JS spinner freezes when the main thread is blocked.
                  The CSS spinner may continue spinning on modern browsers!
                </p>
              </div>
            </section>

            {/* Performance Metrics */}
            <section className={`${styles.panel} glass-panel`}>
              <h2 className={styles.sectionTitle}>INP & Latency Metrics</h2>

              <div className={styles.metricContainer}>
                {/* Interaction Latency */}
                <div className={`${styles.metricCard} glass-card`}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>
                      Last Interaction Latency
                    </span>
                    {inpCategory.label !== "N/A" && (
                      <span
                        className={`${styles.metricBadge} ${inpCategory.class}`}
                      >
                        {inpCategory.label}
                      </span>
                    )}
                  </div>
                  <div className={styles.metricValue}>
                    {displayLatency}
                    <span className={styles.metricUnit}>ms</span>
                  </div>
                  <div className={styles.scoreIndicator}>
                    <div
                      className={`${styles.scoreFill} ${inpCategory.fillClass}`}
                      style={{ width: `${fillPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  lineHeight: "1.4",
                }}
              >
                <p>
                  ⚡ **JS Processing Time:** {jsDuration}ms (synchronous loop
                  duration)
                </p>
                <p>
                  📊 **Browser Event Duration:** {lastInp}ms (captured via
                  PerformanceObserver)
                </p>
                <p
                  style={{
                    color: "var(--text-muted)",
                    marginTop: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                >
                  *INP measures the full delay between the user&apos;s action
                  and the browser&apos;s next painted frame.
                </p>
              </div>
            </section>
          </div>

          {/* History Log */}
          <section
            className={`${styles.panel} ${styles.historyCard} glass-panel`}
          >
            <h2 className={styles.sectionTitle}>Interaction History</h2>
            <p className={styles.cardDescription}>
              Logs of past form submissions and their measured performance
              characteristics.
            </p>

            <div className={styles.historyList}>
              {history.length === 0 ? (
                <p
                  style={{
                    color: "var(--text-muted)",
                    textAlign: "center",
                    padding: "1rem",
                  }}
                >
                  No interactions logged yet. Submit the form above to populate
                  the log.
                </p>
              ) : (
                history.map((item) => {
                  const cat = getInpCategory(item.jsDuration);
                  return (
                    <div key={item.id} className={styles.historyItem}>
                      <span className={styles.historyText}>
                        [{item.timestamp}] Input:{" "}
                        <span className={styles.historyHighlight}>
                          &quot;{item.inputValue}&quot;
                        </span>
                      </span>
                      <span className={styles.historyText}>
                        Target Delay:{" "}
                        <span className={styles.historyHighlight}>
                          {item.configuredDuration}ms
                        </span>{" "}
                        ({item.mode || "Synchronous"}) | Latency:{" "}
                        <span
                          className={`${styles.historyMetric} ${cat.textClass}`}
                        >
                          {item.jsDuration}ms
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </main>

        {/* Dummy Paint Target Div */}
        <div
          id="dummy-paint-target"
          style={{
            opacity: dummyTick % 2 === 0 ? 0.99 : 1,
            width: "1px",
            height: "1px",
            position: "absolute",
            left: "-9999px",
            overflow: "hidden",
          }}
        >
          Paint Tick: {dummyTick}
        </div>

        <footer className={styles.footer}>
          INP Sandbox App • Built with Next.js Pages Router & Bun
        </footer>
      </div>
    </>
  );
}
