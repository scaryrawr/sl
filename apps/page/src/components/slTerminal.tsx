import { useCallback, useEffect, useRef } from 'preact/hooks';

import Terminal from './terminal';

/** Allowed train type identifiers for the SL animation. */
type TrainTypeValue = 'c51' | 'd51' | 'logo';

/**
 * Constant map of train type names to their string values.
 * Use these values when configuring the train animation.
 */
const TrainType = {
  /** C51-class steam locomotive. */
  C51: 'c51',
  /** D51-class steam locomotive (default). */
  D51: 'd51',
  /** Small logo train. */
  LOGO: 'logo'
} as const satisfies Record<string, TrainTypeValue>;

/**
 * Parse a raw string (query parameter, select value) into a train type.
 *
 * @param raw - Untrusted train type string, or `null` when absent.
 * @returns The matching train type, falling back to {@link TrainType.D51}.
 */
const parseTrainType = (raw: string | null): TrainTypeValue =>
  Object.values(TrainType).find((type) => type === raw) ?? TrainType.D51;

/**
 * Count the character cells of a terminal row.
 *
 * The animation grid is addressed in cells, and a cell is one Unicode code
 * point: a supplementary-plane character (an emoji in a car label, for
 * example) fills one cell but is stored as two UTF-16 code units. Sizing the
 * grid from `string.length` would therefore grow the row whenever such a
 * label is drawn, and the next frame would treat the enlarged row as wider
 * than it is.
 *
 * @param row - The row element, or `undefined` when the grid has no such row.
 * @returns The number of code points rendered in the row.
 */
const cellCount = (row: Element | undefined): number => Array.from(row?.textContent ?? '').length;

/**
 * Cell written for empty grid positions.
 *
 * A no-break space (U+00A0) rather than a plain space: runs of ordinary spaces can be
 * collapsed or trimmed whenever the grid is not laid out with `white-space: pre`, which would
 * silently shrink a row and desynchronise it from the animation grid.
 */
const BLANK_CELL = '\xa0';

/**
 * Milliseconds between animation steps.
 *
 * Each step advances the train one column, so this is the web counterpart of the CLI's
 * per-column sleep. 60 ms (~16 steps/second) stays below the requestAnimationFrame cadence
 * because every step repaints the rows it touched as a whole `textContent` write.
 */
const FRAME_INTERVAL_MS = 60;

/** Rows reserved below the static train for the reduced-motion notice. */
const REDUCED_MOTION_MESSAGE_ROWS = 1;

/** Notice drawn in place of the animation when the visitor prefers reduced motion. */
const REDUCED_MOTION_MESSAGE = 'Static view - Animation disabled due to reduced motion preference';

/** Notice drawn when the WASM module cannot be loaded or instantiated. */
const LOAD_FAILURE_MESSAGE = 'Failed to load animation. Please refresh the page to try again.';

/**
 * Write `text` centred inside a `cols`-cell row, padding both sides with {@link BLANK_CELL}.
 *
 * @param cols - Cells available in the row.
 * @param text - Text to centre (its own cell count is used, matching how rows are measured).
 * @returns The row contents, clamped so a text longer than the row cannot overflow the padding.
 */
const centeredRow = (cols: number, text: string): string => {
  const padding = Math.max(0, Math.floor((cols - text.length) / 2));
  const trailing = Math.max(0, cols - padding - text.length);

  return BLANK_CELL.repeat(padding) + text + BLANK_CELL.repeat(trailing);
};

/**
 * Props for the {@link SlTerminal} component.
 */
type SlProps = {
  /** Title bar text for the terminal window. */
  title: string;
  /** Whether to show an accident scene (people crying for help, file listing). */
  accident: boolean;
  /** Whether the train flies through the air (Galaxy Express 999 style). */
  fly: boolean;
  /** Whether to render smoke particles from the train chimney. */
  smoke: boolean;
  /** Which train model to render. */
  trainType: TrainTypeValue;
  /** Array of messages to display on the train cars as they scroll by. */
  messages: string[];
  /** CSS color for terminal text (passed through to {@link Terminal}). */
  fontColor?: string;
  /** CSS background color for the terminal (passed through to {@link Terminal}). */
  backgroundColor?: string;
  /** Stretch the terminal window to fill the viewport (used by embeds; passed through to {@link Terminal}). */
  fill?: boolean;
  /** CSS height for the terminal window (passed through to {@link Terminal}). */
  height?: string;
};

/** Lazy-loaded WASM module promise; initializes the panic hook before resolving. */
const slPromise = import('../websl').then((module) => {
  module.set_panic_hook();

  return module;
});

/**
 * Hook that drives the SL train animation inside a terminal grid.
 *
 * Handles WASM initialization, frame rendering, and accessibility fallback
 * when `prefers-reduced-motion: reduce` is set.
 *
 * @param props - Animation configuration (accident, fly, trainType, messages, smoke).
 * @returns A ref to the terminal `<div>` that parent components can pass to {@link Terminal}.
 */
const useSlAnimation = (props: {
  accident: boolean;
  fly: boolean;
  trainType: TrainTypeValue;
  messages: string[];
  smoke: boolean;
}) => {
  const { accident, fly, trainType, messages, smoke } = props;
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xRef = useRef<number | null>(null);

  // Persistent animation grid: one code-point array per row, initialized from the
  // DOM once and re-initialized whenever the terminal's row elements are replaced
  // (resize). The grid stays the source of truth across frames so per-frame work is
  // O(touched rows) without re-parsing textContent on every row.
  const gridRef = useRef<{ firstRow: Element; rows: string[][] } | null>(null);
  const dirtyRowsRef = useRef(new Set<number>());

  const clear = useCallback(() => {
    const terminal = terminalRef.current;

    if (!terminal || terminal.children.length === 0) return;

    const cols = cellCount(terminal.children[0]);

    for (const row of Array.from(terminal.children)) {
      // SAFETY: Terminal renders every child of the grid as a row <div> element.
      const el = row as HTMLElement;
      el.textContent = BLANK_CELL.repeat(cols);
    }

    // Keep the persistent grid consistent with the cleared DOM.
    gridRef.current = {
      firstRow: terminal.children[0],
      rows: Array.from(terminal.children).map(() => Array(cols).fill(BLANK_CELL))
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let timeoutId: number | undefined;
    let disposed = false;
    let releaseSmoke: (() => void) | undefined;
    let releaseDisplay: (() => void) | undefined;

    // Check for reduced motion preference - show static fallback if preferred
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Display static train when animation is disabled
      const terminal = terminalRef.current;

      if (terminal && terminal.children.length > 0) {
        // D51 steam locomotive ASCII art
        const standardTrain = [
          '      ====        ________                ___________ ',
          '  _D _|  |_______/        \\__I_I_____===__|_________| ',
          '   |(_)---  |   H\\________/ |   |        =|___ ___|   ',
          '   /     |  |   H  |  |     |   |         ||_| |_||   ',
          '  |      |  |   H  |__--------------------| [___] |   ',
          '  | ________|___H__/__|_____/[][]~\\_______|       |   ',
          '  |/ |   |-----------I_____I [][] []  D   |=======|__ ',
          '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ',
          ' |/-=|___|=    ||    ||    ||    |_____/~\\___/         ',
          '  \\_/      \\O=====O=====O=====O_/      \\_/             '
        ];

        // First animation frame of libsl's C51 engine, without its trailing blank row.
        const c51Train = [
          '        ___                                            ',
          '       _|_|_  _     __       __             ___________',
          '    D__/   \\_(_)___|  |__H__|  |_____I_Ii_()|_________|',
          "     | `---'   |:: `--'  H  `--'         |  |___ ___|  ",
          '    +|~~~~~~~~++::~~~~~~~H~~+=====+~~~~~~|~~||_| |_||  ',
          '    ||        | ::       H  +=====+      |  |::  ...|  ',
          '|    | _______|_::-----------------[][]-----|       |  ',
          '| /~~ ||   |-----/~~~~\\  /[I_____I][][] --|||_______|__',
          "------'|oOo|=[]=-      ||      ||      |  ||=======_|__",
          '/~\\____|___|/~\\_|  O=======O=======O   |__|+-/~\\_|     ',
          '\\_/         \\_/  \\____/  \\____/  \\____/      \\_/       '
        ];

        const staticTrains: Record<TrainTypeValue, string[]> = {
          [TrainType.D51]: standardTrain,
          [TrainType.C51]: c51Train,
          [TrainType.LOGO]: [
            '     ++      +------ ',
            '     ||      |+-+ |  ',
            '   /---------|| | |  ',
            '  + ========  +-+ |  ',
            ' _|--O========O~\\-+  ',
            '//// \\_/      \\_/    ',
            '                     '
          ]
        };

        const staticTrain = staticTrains[trainType] || standardTrain;
        const minRequiredRows = staticTrain.length + REDUCED_MOTION_MESSAGE_ROWS;

        // Check if terminal is large enough to display static content
        if (terminal.children.length < minRequiredRows) {
          return;
        }

        // Center the train vertically, leaving the notice row underneath it.
        const startRow = Math.max(
          0,
          Math.floor((terminal.children.length - staticTrain.length - REDUCED_MOTION_MESSAGE_ROWS) / 2)
        );

        const renderStaticRow = (row: Element | undefined, text: string) => {
          if (!row) return;

          const cols = cellCount(row);
          row.textContent = centeredRow(cols, text.slice(0, cols));
        };

        staticTrain.forEach((line, idx) => renderStaticRow(terminal.children[startRow + idx], line));
        renderStaticRow(
          terminal.children[startRow + staticTrain.length],
          REDUCED_MOTION_MESSAGE
        );
      }

      return () => {
        disposed = true;
      };
    }

    // Invalidate the persistent grid once per animated effect so its first
    // frame reads the current DOM. A prior reduced-motion render (or cleanup)
    // may have left the DOM — and therefore the rows — different from the
    // cached grid, and flushing a stale grid would erase cells outside the
    // current draw range.
    gridRef.current = null;

    const runWasm = async () => {
      try {
        const sl = await slPromise;

        if (disposed) return;

        const terminal = terminalRef.current;

        if (!terminal || terminal.children.length === 0) return;

        const options = new sl.Options(accident, fly, smoke);
        let trainSmoke = new sl.Smoke();

        releaseSmoke = () => trainSmoke.free();

        const resetSmoke = () => {
          trainSmoke.free();
          trainSmoke = new sl.Smoke();
        };

        const trains: Record<TrainTypeValue, typeof sl.add_c51> = {
          [TrainType.C51]: sl.add_c51,
          [TrainType.D51]: sl.add_d51,
          [TrainType.LOGO]: sl.add_logo
        };

        if (xRef.current === null) {
          xRef.current = cellCount(terminal.children[0]);
        }

        // Read the persistent grid, re-initializing from the DOM only when the
        // terminal's row elements were replaced (resize).
        const getGrid = () => {
          const firstRow = terminal.children[0];
          const existing = gridRef.current;

          if (existing && existing.firstRow === firstRow && existing.rows.length === terminal.children.length) {
            return existing;
          }

          // SAFETY: terminal's children are row <div> elements (the same
          // invariant used everywhere else in this file); textContent on each
          // row is all the grid is built from.
          const rows = Array.from(terminal.children).map((row) => Array.from((row as HTMLElement).textContent ?? ''));

          const fresh = { firstRow, rows };
          gridRef.current = fresh;

          return fresh;
        };

        const displayCallback = (y: number, x: number, str: string) => {
          const grid = gridRef.current;

          if (!grid || y < 0 || y >= grid.rows.length) return;

          const buf = grid.rows[y];
          dirtyRowsRef.current.add(y);

          // Iterate by code point so every cell advances once, matching the
          // Array.from() buffer layout and the cellCount() grid width.
          let col = x;

          for (const ch of str) {
            if (col >= buf.length) break;

            buf[col] = ch;
            col += 1;
          }
        };

        // Reuse one Display per animation (recreating only when the grid size
        // changes, e.g. after a resize) instead of allocating a new wasm
        // instance on every frame.
        let display: InstanceType<typeof sl.Display> | null = null;
        let displayCols = -1;
        let displayRows = -1;

        const ensureDisplay = (cols: number, rows: number) => {
          if (!display || displayCols !== cols || displayRows !== rows) {
            // Free the previous display before replacing it so the WASM
            // callback and state it owns do not leak across resizes.
            display?.free();
            display = new sl.Display(cols, rows, displayCallback);
            displayCols = cols;
            displayRows = rows;
          }

          return display;
        };

        releaseDisplay = () => {
          display?.free();
          display = null;
        };

        const animate = () => {
          if (disposed) return;

          const grid = getGrid();
          const rows = grid.rows.length;
          const cols = grid.rows[0]?.length ?? 0;
          const displayInstance = ensureDisplay(cols, rows);
          dirtyRowsRef.current.clear();

          if ((xRef.current ?? 0) > cols) {
            clear();
            xRef.current = cols;
            resetSmoke();
          }

          const nextX = (xRef.current ?? 0) - 1;

          xRef.current = nextX;

          if (!trains[trainType](nextX, messages, displayInstance, options, trainSmoke)) {
            clear();
            xRef.current = cols;
            resetSmoke();
          }

          // Flush the rows touched this frame (one textContent write per row).
          const liveGrid = gridRef.current;

          if (liveGrid && liveGrid.firstRow === grid.firstRow) {
            for (const rowIdx of dirtyRowsRef.current) {
              // SAFETY: Terminal renders every child of the grid as a row <div> element.
              const row = terminal.children[rowIdx] as HTMLElement | undefined;

              if (row) row.textContent = liveGrid.rows[rowIdx].join('');
            }
          }

          // Use setTimeout + RAF pattern to reduce callback overhead
          timeoutId = window.setTimeout(() => {
            animationFrameId = requestAnimationFrame(animate);
          }, FRAME_INTERVAL_MS);
        };

        animationFrameId = requestAnimationFrame(animate);
      } catch (error) {
        console.error('Failed to load WASM module', error);

        if (disposed) return;
        const terminal = terminalRef.current;

        if (!terminal || terminal.children.length === 0) return;
        // SAFETY: Terminal renders every child of the grid as a row <div> element.
        const row = terminal.children[0] as HTMLElement | undefined;

        if (!row) return;
        row.textContent = centeredRow(row.textContent?.length ?? 0, LOAD_FAILURE_MESSAGE);
      }
    };

    void runWasm();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
      releaseSmoke?.();
      releaseDisplay?.();
      clear();
    };
  }, [accident, fly, trainType, messages, smoke, clear]);

  return terminalRef;
};

/**
 * Top-level component that renders the SL train animation inside a faux terminal window.
 *
 * Combines {@link Terminal} (the visual terminal shell) with {@link useSlAnimation}
 * (the WASM-driven animation loop). Also respects `prefers-reduced-motion` by showing
 * a static train when animations are disabled.
 *
 * @param props - Configuration for the terminal and animation.
 * @returns A terminal window with the animated steam locomotive.
 */
const SlTerminal = ({
  title,
  accident,
  fly,
  trainType,
  messages,
  smoke,
  fontColor,
  backgroundColor,
  fill,
  height
}: SlProps) => {
  const terminalRef = useSlAnimation({ accident, fly, trainType, messages, smoke });

  return (
    <Terminal
      title={title}
      terminalRef={terminalRef}
      fontColor={fontColor}
      backgroundColor={backgroundColor}
      fill={fill}
      height={height}
    />
  );
};

export { TrainType, parseTrainType };

export type { TrainTypeValue };

export default SlTerminal;
