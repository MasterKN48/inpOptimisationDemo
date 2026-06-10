import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import styles from "@/styles/Home.module.css";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [blockDuration, setBlockDuration] = useState(1000); // 1s default
  const [isBlocked, setIsBlocked] = useState(false);
  const [lastInp, setLastInp] = useState(0);
  const [jsDuration, setJsDuration] = useState(0);
  const [history, setHistory] = useState([]);

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

  const handleSubmit = (e) => {
    e.preventDefault();

    // Temporarily mark status as blocked (Note: UI will only repaint this *after* the sync block completes,
    // which illustrates the core problem of high INP / unresponsive event loops)
    setIsBlocked(true);

    const start = performance.now();

    // Run CPU heavy loop
    const actualDuration = simulateHeavyComputation(blockDuration);

    const end = performance.now();
    const processingTime = Math.round(end - start);

    // Update state after blocking
    setJsDuration(processingTime);
    setIsBlocked(false);

    // Add to history
    const timestamp = new Date().toLocaleTimeString();
    setHistory((prev) => [
      {
        id: Date.now(),
        inputValue: inputValue || "(empty)",
        configuredDuration: blockDuration,
        jsDuration: processingTime,
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
                  onChange={(e) => setInputValue(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="delay-slider">
                  Simulated CPU Block Duration
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

              <button type="submit" className={styles.submitBtn}>
                Submit & Block Main Thread
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
                        | Latency:{" "}
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

        <footer className={styles.footer}>
          INP Sandbox App • Built with Next.js Pages Router & Bun
        </footer>
      </div>
    </>
  );
}
