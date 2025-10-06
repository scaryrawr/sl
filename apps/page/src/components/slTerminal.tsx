import { RefObject, useCallback, useEffect, useRef } from 'react';
import { TrainType, TrainTypeValue } from '../types';
import Terminal from './terminal';

interface SlModule {
  Display: new (cols: number, rows: number, writer: (y: number, x: number, str: string) => void) => unknown;
  Options: new (accident: boolean, fly: boolean, smoke: boolean) => unknown;
  add_c51: (x: number, messages: string[], display: unknown, options: unknown) => boolean;
  add_d51: (x: number, messages: string[], display: unknown, options: unknown) => boolean;
  add_logo: (x: number, messages: string[], display: unknown, options: unknown) => boolean;
  set_panic_hook: () => void;
}

const slPromise = import('websl').then((module) => {
  (module as SlModule).set_panic_hook();
  return module as SlModule;
});

interface UseSlAnimationProps {
  accident: boolean;
  fly: boolean;
  trainType: TrainTypeValue;
  messages: string[];
  smoke: boolean;
}

const useSlAnimation = (props: UseSlAnimationProps): RefObject<HTMLDivElement> => {
  const { accident, fly, trainType, messages, smoke } = props;
  const terminalRef = useRef<HTMLDivElement>(null);
  const xRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    for (const row of Array.from(terminal.children)) {
      if (row instanceof HTMLElement && terminal.children[0] instanceof HTMLElement) {
        row.textContent = '\xa0'.repeat(terminal.children[0].textContent?.length || 0);
      }
    }
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let disposed = false;

    const runWasm = async () => {
      const sl = await slPromise;
      if (disposed) return;

      const terminal = terminalRef.current;
      if (!terminal) return;

      const options = new sl.Options(accident, fly, smoke);
      const trains = {
        [TrainType.C51]: sl.add_c51,
        [TrainType.D51]: sl.add_d51,
        [TrainType.LOGO]: sl.add_logo
      };

      if (xRef.current === null && terminal.children[0]) {
        xRef.current = terminal.children[0].textContent?.length || 0;
      }

      intervalId = setInterval(() => {
        const cols = terminal.children[0]?.textContent?.length || 0;
        const rows = terminal.children.length;
        const display = new sl.Display(cols, rows, (y: number, x: number, str: string) => {
          const row = terminal?.children[y];
          if (!row || !(row instanceof HTMLElement) || !row.textContent) return;

          let newText = row.textContent.substring(0, x) + str + row.textContent.substring(x + str.length);
          newText += '\xa0'.repeat(cols - newText.length);
          row.textContent = newText.substring(0, row.textContent.length);
        });

        if (xRef.current !== null && xRef.current > cols) {
          clear();
          xRef.current = cols;
        }

        if (xRef.current !== null) {
          xRef.current--;
          if (!trains[trainType](xRef.current, messages, display, options)) {
            clear();
            xRef.current = cols;
          }
        }
      }, 60);
    };

    runWasm();

    return () => {
      disposed = true;
      clearInterval(intervalId);
      clear();
    };
  }, [accident, fly, trainType, messages, smoke, clear]);

  return terminalRef;
};

interface SlTerminalProps {
  title: string;
  accident: boolean;
  fly: boolean;
  trainType: TrainTypeValue;
  messages: string[];
  smoke: boolean;
  fontColor: string;
  backgroundColor: string;
}

const SlTerminal = ({ title, accident, fly, trainType, messages, smoke, fontColor, backgroundColor }: SlTerminalProps) => {
  const terminalRef = useSlAnimation({ accident, fly, trainType, messages, smoke });

  return <Terminal title={title} terminalRef={terminalRef} fontColor={fontColor} backgroundColor={backgroundColor} />;
};

export { TrainType };
export default SlTerminal;
