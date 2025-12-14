import { useCallback, useEffect, useRef } from 'preact/hooks';
import Terminal from './terminal';

type TrainTypeValue = 'c51' | 'd51' | 'logo';

const TrainType = {
  C51: 'c51',
  D51: 'd51',
  LOGO: 'logo'
} as const satisfies Record<string, TrainTypeValue>;

type SlProps = {
  title: string;
  accident: boolean;
  fly: boolean;
  smoke: boolean;
  trainType: TrainTypeValue;
  messages: string[];
  fontColor?: string;
  backgroundColor?: string;
};

const slPromise = import('websl').then((module) => {
  module.set_panic_hook();
  return module;
});

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
    const frameInterval = 60; // 60ms = ~16.67 FPS (reduced from 60 FPS for performance)

    const runWasm = async () => {
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

const SlTerminal = ({ title, accident, fly, trainType, messages, smoke, fontColor, backgroundColor }: SlProps) => {
  const terminalRef = useSlAnimation({ accident, fly, trainType, messages, smoke });

  return <Terminal title={title} terminalRef={terminalRef} fontColor={fontColor} backgroundColor={backgroundColor} />;
};

export { TrainType };
export type { TrainTypeValue };
export default SlTerminal;
