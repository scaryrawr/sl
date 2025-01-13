import { useEffect, useRef } from 'react';
import Terminal from './terminal.jsx';

const TrainType = {
  C51: 'c51',
  D51: 'd51',
  LOGO: 'logo'
};

const slPromise = import('websl').then((module) => {
  module.set_panic_hook();
  return module;
});

const SlTerminal = ({ title, accident, fly, trainType, messages, smoke }) => {
  const terminalRef = useRef(null);
  const xRef = useRef(null);

  useEffect(() => {
    let intervalId;
    let disposed = false;
    const terminal = terminalRef.current;

    const clear = () => {
      if (!terminal) {
        return;
      }
      for (const row of Array.from(terminal.children)) {
        row.textContent = '\xa0'.repeat(terminal.children[0].textContent.length);
      }
    };

    const runWasm = async () => {
      const sl = await slPromise;
      if (disposed) return;

      if (!terminal) {
        return;
      }

      const options = new sl.Options(accident, fly, smoke);
      const trains = {
        [TrainType.C51]: sl.add_c51,
        [TrainType.D51]: sl.add_d51,
        [TrainType.LOGO]: sl.add_logo
      };

      if (xRef.current === null) {
        xRef.current = terminal.children[0].textContent.length;
      }

      intervalId = setInterval(() => {
        let cols = terminal.children[0].textContent.length;
        let rows = terminal.children.length;
        let display = new sl.Display(cols, rows, (y, x, str) => {
          let row = terminal?.children[y];
          if (!row || !row.textContent) {
            return;
          }

          let newText = row.textContent.substring(0, x) + str + row.textContent.substring(x + str.length);
          newText += '\xa0'.repeat(cols - newText.length);
          row.textContent = newText.substring(0, row.textContent.length);
        });

        if (xRef.current > cols) {
          clear();
          xRef.current = cols;
        }

        if (!trains[trainType](--xRef.current, messages, display, options)) {
          clear();
          xRef.current = cols;
        }
      }, 60);
    };

    runWasm();

    return () => {
      disposed = true;
      clearInterval(intervalId);
      clear();
    };
  }, [accident, fly, trainType, messages, smoke]);

  return <Terminal title={title} terminalRef={terminalRef} />;
};

export { TrainType };
export default SlTerminal;
