import type { JSX, RefObject } from 'preact';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';

// Approximate character dimensions for 16px monospace font
const CHAR_WIDTH_ESTIMATE = 9.6;
const CHAR_HEIGHT_ESTIMATE = 19;
const LINE_HEIGHT_MULTIPLIER = 1.2;
const CACHE_VERSION = 'v1';

const styles = {
  window: {
    border: '1px solid black',
    borderRadius: '5px',
    width: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    margin: '20px auto',
    backgroundColor: '#fff',
    // Fixed height to prevent layout shift
    height: 'calc(80vh - 40px)'
  },
  titleBar: {
    backgroundColor: '#333',
    color: '#fff',
    padding: '5px',
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  },
  title: {
    fontWeight: 'bold'
  },
  buttons: {
    display: 'flex',
    gap: '5px'
  },
  button: {
    backgroundColor: '#555',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  terminal: {
    fontFamily: 'monospace',
    whiteSpace: 'pre',
    flex: 1,
    padding: '10px',
    overflow: 'hidden',
    minHeight: 0, // Allow flex child to shrink
    lineHeight: '1.2' // Match LINE_HEIGHT_MULTIPLIER for consistent measurements
  }
} satisfies Record<'window' | 'titleBar' | 'title' | 'buttons' | 'button' | 'terminal', JSX.CSSProperties>;

type TerminalProps = {
  title: string;
  terminalRef?: RefObject<HTMLDivElement | null>;
  fontColor?: string;
  backgroundColor?: string;
};

const Terminal = ({ title, terminalRef: externalRef, fontColor = '#0f0', backgroundColor = '#000' }: TerminalProps) => {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = externalRef ?? internalRef;
  const dimensionsRef = useRef<{ rows: number; cols: number } | null>(null);
  const initializedRef = useRef(false);
  const charSizeRef = useRef<{ width: number; height: number } | null>(null);

  // Use useLayoutEffect to measure and build rows synchronously before paint
  useLayoutEffect(() => {
    let disposed = false;
    const terminal = terminalRef.current;
    if (!terminal) return;

    const measureAndUpdate = () => {
      if (disposed) return;
      // Measure character size using Canvas API (no DOM manipulation, no forced reflow)
      if (!charSizeRef.current) {
        const computedStyle = window.getComputedStyle(terminal);
        const fontFamily = computedStyle.fontFamily;
        const fontSize = computedStyle.fontSize;
        const fontWeight = computedStyle.fontWeight;
        const fontStyle = computedStyle.fontStyle;

        // Try to load from localStorage cache first
        const cacheKey = `sl-font-metrics-${CACHE_VERSION}-${fontFamily}-${fontSize}-${fontWeight}-${fontStyle}`;
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            // Validate structure
            if (
              typeof parsed.width === 'number' &&
              typeof parsed.height === 'number' &&
              parsed.width > 0 &&
              parsed.height > 0
            ) {
              // Check if Fira Mono is required and loaded
              if (fontFamily.startsWith('Fira Mono')) {
                if (document.fonts.check(`${fontSize} "Fira Mono"`)) {
                  charSizeRef.current = parsed;
                }
              } else {
                charSizeRef.current = parsed;
              }
            }
          }
        } catch {
          // Invalid cache, remove it
          try {
            localStorage.removeItem(cacheKey);
          } catch {
            // localStorage disabled, proceed without caching
          }
        }

        if (!charSizeRef.current) {
          // Check if Fira Mono is specified and wait for it to load
          if (fontFamily.startsWith('Fira Mono')) {
            const fontLoaded = document.fonts.check(`${fontSize} "Fira Mono"`);
            if (!fontLoaded) {
              // Font not ready, use estimates and wait for font to load
              charSizeRef.current = { width: CHAR_WIDTH_ESTIMATE, height: CHAR_HEIGHT_ESTIMATE };
              // Remeasure once font is loaded
              document.fonts
                .load(`${fontSize} "Fira Mono"`)
                .then(() => {
                  if (!disposed) {
                    charSizeRef.current = null;
                    measureAndUpdate();
                  }
                })
                .catch(() => {
                  // Font failed to load, keep using estimates
                });
              return;
            }
          }

          // Font is ready or not needed, measure accurately
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.font = `${fontSize} ${fontFamily}`;
              const metrics = ctx.measureText('M'); // Use 'M' as it's typically widest in monospace
              const fontSizeNum = parseFloat(fontSize) || 16;

              // Use TextMetrics bounding box for more accurate line height
              const lineHeight =
                metrics.fontBoundingBoxAscent && metrics.fontBoundingBoxDescent
                  ? metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
                  : fontSizeNum * LINE_HEIGHT_MULTIPLIER;

              charSizeRef.current = {
                width: metrics.width || CHAR_WIDTH_ESTIMATE,
                height: lineHeight || CHAR_HEIGHT_ESTIMATE
              };

              // Cache the measured metrics
              try {
                localStorage.setItem(cacheKey, JSON.stringify(charSizeRef.current));
              } catch (e) {
                // Handle quota exceeded by clearing old caches
                if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                  try {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                      const key = localStorage.key(i);
                      if (key?.startsWith('sl-font-metrics-')) {
                        localStorage.removeItem(key);
                      }
                    }
                    // Retry after cleanup
                    localStorage.setItem(cacheKey, JSON.stringify(charSizeRef.current));
                  } catch {
                    // Still failed, proceed without caching
                  }
                }
              }
            } else {
              charSizeRef.current = { width: CHAR_WIDTH_ESTIMATE, height: CHAR_HEIGHT_ESTIMATE };
            }
          } catch (error) {
            console.error('Failed to measure terminal:', error);
            charSizeRef.current = { width: CHAR_WIDTH_ESTIMATE, height: CHAR_HEIGHT_ESTIMATE };
          }
        }
      }

      const { width: charWidth, height: lineHeight } = charSizeRef.current;

      // Batch all DOM reads
      const { clientWidth, clientHeight } = terminal;
      const cols = Math.floor(clientWidth / charWidth);
      const rows = Math.min(80, Math.floor(clientHeight / lineHeight));

      const prev = dimensionsRef.current;
      // Only rebuild if dimensions actually changed
      if (!prev || prev.rows !== rows || prev.cols !== cols) {
        dimensionsRef.current = { rows, cols };

        // Use DocumentFragment to batch all DOM writes
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < rows; i++) {
          const row = document.createElement('div');
          row.textContent = '\xa0'.repeat(cols);
          fragment.appendChild(row);
        }

        // Single DOM write operation using modern API
        terminal.replaceChildren(fragment);
      }

      initializedRef.current = true;
    };

    measureAndUpdate();

    const resizeObserver = new ResizeObserver(() => {
      // Skip resize events during initial render
      if (initializedRef.current && !disposed) {
        measureAndUpdate();
      }
    });
    resizeObserver.observe(terminal);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
    };
  }, [terminalRef]);

  const terminalStyle = useMemo(
    () => ({
      ...styles.terminal,
      color: fontColor,
      backgroundColor
    }),
    [fontColor, backgroundColor]
  );

  return (
    <div style={styles.window}>
      <div style={styles.titleBar} aria-hidden="true">
        <span style={styles.title}>{title}</span>
        <div style={styles.buttons}>
          <span style={styles.button}>_</span>
          <span style={styles.button}>□</span>
          <span style={styles.button}>×</span>
        </div>
      </div>
      <div
        ref={terminalRef}
        style={terminalStyle}
        role="img"
        aria-label="Animated ASCII art train moving across terminal screen"
      ></div>
    </div>
  );
};

export default Terminal;
