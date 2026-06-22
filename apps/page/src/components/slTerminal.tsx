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

  const clear = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal || terminal.children.length === 0) return;

    const cols = terminal.children[0].textContent?.length ?? 0;
    for (const row of Array.from(terminal.children)) {
      const el = row as HTMLElement;
      el.textContent = '\xa0'.repeat(cols);
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let timeoutId: number | undefined;
    let disposed = false;

    // Check for reduced motion preference - show static fallback if preferred
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Display static train when animation is disabled
      const terminal = terminalRef.current;
      if (terminal && terminal.children.length > 0) {
        // Standard steam locomotive ASCII art (used for both D51 and C51)
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

        const staticTrains: Record<TrainTypeValue, string[]> = {
          [TrainType.D51]: standardTrain,
          [TrainType.C51]: standardTrain,
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
        const MESSAGE_ROWS = 1; // Reserve rows for accessibility message
        const minRequiredRows = staticTrain.length + MESSAGE_ROWS;

        // Check if terminal is large enough to display static content
        if (terminal.children.length < minRequiredRows) {
          return;
        }

        // Center the train vertically (accounting for message row)
        const startRow = Math.max(0, Math.floor((terminal.children.length - staticTrain.length - MESSAGE_ROWS) / 2));

        // Render static train centered both vertically and horizontally
        staticTrain.forEach((line, idx) => {
          const row = terminal.children[startRow + idx] as HTMLElement | undefined;
          if (row) {
            const cols = row.textContent?.length ?? 0;
            const padding = Math.max(0, Math.floor((cols - line.length) / 2));
            row.textContent = '\xa0'.repeat(padding) + line + '\xa0'.repeat(cols - padding - line.length);
          }
        });

        // Add accessibility message explaining why animation is disabled
        const msgRow = terminal.children[startRow + staticTrain.length] as HTMLElement | undefined;
        if (msgRow) {
          const msg = 'Static view - Animation disabled due to reduced motion preference';
          const cols = msgRow.textContent?.length ?? 0;
          const padding = Math.max(0, Math.floor((cols - msg.length) / 2));
          msgRow.textContent = '\xa0'.repeat(padding) + msg + '\xa0'.repeat(cols - padding - msg.length);
        }
      }

      return () => {
        disposed = true;
      };
    }

    const frameInterval = 60; // 60ms = ~16.67 FPS (reduced from 60 FPS for performance)

    const runWasm = async () => {
      try {
        const sl = await slPromise;
        if (disposed) return;

        const terminal = terminalRef.current;
        if (!terminal || terminal.children.length === 0) return;

        const options = new sl.Options(accident, fly, smoke);
        const trains: Record<TrainTypeValue, typeof sl.add_c51> = {
          [TrainType.C51]: sl.add_c51,
          [TrainType.D51]: sl.add_d51,
          [TrainType.LOGO]: sl.add_logo
        };

        if (xRef.current === null) {
          xRef.current = terminal.children[0].textContent?.length ?? 0;
        }

        const animate = () => {
          if (disposed) return;

          const cols = terminal.children[0].textContent?.length ?? 0;
          const rows = terminal.children.length;
          const display = new sl.Display(cols, rows, (y: number, x: number, str: string) => {
            const row = terminal.children[y] as HTMLElement | undefined;
            if (!row || !row.textContent) return;

            // Use array-based approach for better performance
            const textArray = Array.from(row.textContent);
            for (let i = 0; i < str.length && x + i < cols; i++) {
              textArray[x + i] = str[i];
            }
            row.textContent = textArray.join('');
          });

          if ((xRef.current ?? 0) > cols) {
            clear();
            xRef.current = cols;
          }

          if (!trains[trainType](--(xRef.current as number), messages, display, options)) {
            clear();
            xRef.current = cols;
          }

          // Use setTimeout + RAF pattern to reduce callback overhead
          timeoutId = window.setTimeout(() => {
            animationFrameId = requestAnimationFrame(animate);
          }, frameInterval);
        };

        animationFrameId = requestAnimationFrame(animate);
      } catch (error) {
        console.error('Failed to load WASM module', error);
        if (disposed) return;
        const message = 'Failed to load animation. Please refresh the page to try again.';
        const terminal = terminalRef.current;
        if (!terminal || terminal.children.length === 0) return;
        const row = terminal.children[0] as HTMLElement | undefined;
        if (!row) return;
        const cols = row.textContent?.length ?? 0;
        const padding = Math.max(0, Math.floor((cols - message.length) / 2));
        row.textContent =
          '\xa0'.repeat(padding) + message + '\xa0'.repeat(Math.max(0, cols - padding - message.length));
      }
    };

    runWasm();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
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
const SlTerminal = ({ title, accident, fly, trainType, messages, smoke, fontColor, backgroundColor }: SlProps) => {
  const terminalRef = useSlAnimation({ accident, fly, trainType, messages, smoke });

  return <Terminal title={title} terminalRef={terminalRef} fontColor={fontColor} backgroundColor={backgroundColor} />;
};

export { TrainType };
export type { TrainTypeValue };
export default SlTerminal;
