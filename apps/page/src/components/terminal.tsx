import type { JSX, RefObject } from 'preact';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';

/** Default terminal text color: the phosphor green of the vintage terminals `sl` ran on. */
const DEFAULT_FONT_COLOR = '#0f0';

/** Default terminal background color, chosen so the green glyphs read as a CRT screen. */
const DEFAULT_BACKGROUND_COLOR = '#000';

/** Font size assumed when `getComputedStyle` hands back a size that is not a plain pixel number. */
const FALLBACK_FONT_SIZE_PX = 16;

/** Advance width of a monospace cell as a share of the font size: the classic 0.6em. */
const MONOSPACE_ADVANCE_RATIO = 0.6;

/** Multiplier applied to font size to compute line height when TextMetrics bounding box is unavailable. */
const LINE_HEIGHT_MULTIPLIER = 1.2;

/** Approximate cell width for a {@link FALLBACK_FONT_SIZE_PX} monospace, before measurement. */
const CHAR_WIDTH_ESTIMATE = FALLBACK_FONT_SIZE_PX * MONOSPACE_ADVANCE_RATIO;

/** Approximate cell height for a {@link FALLBACK_FONT_SIZE_PX} monospace, at the same {@link LINE_HEIGHT_MULTIPLIER}. */
const CHAR_HEIGHT_ESTIMATE = Math.floor(FALLBACK_FONT_SIZE_PX * LINE_HEIGHT_MULTIPLIER);

/** Glyph used to measure a monospace cell: `M` is the widest letter in most fixed-width faces. */
const MEASURE_GLYPH = 'M';

/** Version tag for the localStorage font-metrics cache key; bump to invalidate stale measurements. */
const CACHE_VERSION = 'v1';

/** localStorage key prefix for cached font metrics; also the prefix used to sweep old entries. */
const FONT_METRICS_CACHE_PREFIX = 'sl-font-metrics-';

/** Hard ceiling on grid rows, so a very tall viewport cannot build thousands of row elements. */
const MAX_TERMINAL_ROWS = 80;

/** Height of the demo terminal window as a share of the viewport. */
const WINDOW_HEIGHT = '80vh';

/** Outer margin above and below the window (`margin: ${WINDOW_MARGIN_PX}px auto`). */
const WINDOW_MARGIN_PX = 20;

/** Character cell measurements cached in localStorage. */
type FontMetrics = { width: number; height: number };

/** Validate font metrics decoded from the localStorage cache before trusting them. */
const isFontMetrics = (value: unknown): value is FontMetrics =>
  value instanceof Object &&
  'width' in value &&
  'height' in value &&
  typeof value.width === 'number' &&
  typeof value.height === 'number';

const styles = {
  window: {
    border: '1px solid black',
    borderRadius: '5px',
    width: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    margin: `${WINDOW_MARGIN_PX}px auto`,
    backgroundColor: '#fff',
    // Fixed height to prevent layout shift: the window box minus its own vertical margins.
    height: `calc(${WINDOW_HEIGHT} - ${WINDOW_MARGIN_PX * 2}px)`
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
    lineHeight: String(LINE_HEIGHT_MULTIPLIER) // Keep the painted rhythm equal to the measured one
  }
} satisfies Record<'window' | 'titleBar' | 'title' | 'buttons' | 'button' | 'terminal', JSX.CSSProperties>;

/**
 * Props for the {@link Terminal} component.
 */
type TerminalProps = {
  /** Text displayed in the terminal window title bar. */
  title: string;
  /** Optional external ref to the inner terminal div, used by parent components to write animation frames. */
  terminalRef?: RefObject<HTMLDivElement | null>;
  /** CSS color for terminal text (default: `#0f0` green). */
  fontColor?: string;
  /** CSS background color for the terminal area (default: `#000` black). */
  backgroundColor?: string;
  /**
   * Stretch the window to fill the viewport (no outer margin, border, or rounded
   * corners) and use `backgroundColor` for the window backing. Used by embeds so
   * the terminal exactly fills an `<iframe>` without white letterboxing or scrollbars.
   */
  fill?: boolean;
  /**
   * CSS height for the terminal window (default: `calc(80vh - 40px)`). Used by the
   * per-train showcases so several terminals stack down the page without each one
   * claiming most of the viewport.
   */
  height?: string;
};

/**
 * Renders a faux terminal window with a title bar and a monospace text area.
 *
 * Automatically measures character dimensions using the Canvas API and builds a grid
 * of `<div>` rows sized to fit the available space. Resizes are handled via `ResizeObserver`.
 *
 * @param props - Terminal configuration props.
 * @returns A styled terminal window element.
 */
const Terminal = ({
  title,
  terminalRef: externalRef,
  fontColor = DEFAULT_FONT_COLOR,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  fill = false,
  height
}: TerminalProps) => {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = externalRef ?? internalRef;
  const dimensionsRef = useRef<{ rows: number; cols: number } | null>(null);
  const initializedRef = useRef(false);
  const charSizeRef = useRef<FontMetrics | null>(null);

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
        const cacheKey = `${FONT_METRICS_CACHE_PREFIX}${CACHE_VERSION}-${fontFamily}-${fontSize}-${fontWeight}-${fontStyle}`;

        try {
          const cached = localStorage.getItem(cacheKey);

          if (cached) {
            const parsed: unknown = JSON.parse(cached);

            // Validate structure
            if (isFontMetrics(parsed) && parsed.width > 0 && parsed.height > 0) {
              charSizeRef.current = parsed;
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
          // Measure the resolved font
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (ctx) {
              ctx.font = `${fontSize} ${fontFamily}`;
              const metrics = ctx.measureText(MEASURE_GLYPH);
              const fontSizeNum = parseFloat(fontSize) || FALLBACK_FONT_SIZE_PX;

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

                      if (key?.startsWith(FONT_METRICS_CACHE_PREFIX)) {
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
      const rows = Math.min(MAX_TERMINAL_ROWS, Math.floor(clientHeight / lineHeight));

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

  const windowStyle = useMemo(() => {
    if (fill) {
      return {
        ...styles.window,
        margin: 0,
        height: '100vh',
        border: 'none',
        borderRadius: 0,
        backgroundColor
      };
    }

    if (!height) return styles.window;

    return { ...styles.window, height };
  }, [fill, backgroundColor, height]);

  const terminalStyle = useMemo(
    () => ({
      ...styles.terminal,
      color: fontColor,
      backgroundColor
    }),
    [fontColor, backgroundColor]
  );

  return (
    <div style={windowStyle}>
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

export { DEFAULT_BACKGROUND_COLOR, DEFAULT_FONT_COLOR };

export default Terminal;
