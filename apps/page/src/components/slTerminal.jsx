import { useEffect, useRef } from 'react';
import Terminal from './terminal.jsx';

const TrainType = {
  C51: 'c51',
  D51: 'd51',
  LOGO: 'logo'
};

const SlTerminal = ({ title, accident, fly, trainType, messages }) => {
  const terminalRef = useRef(null);

  useEffect(() => {
    const runWasm = async () => {
      const sl = await import('websl');
      sl.set_panic_hook();

      const terminal = terminalRef.current;
      if (!terminal) {
        return;
      }

      const options = new sl.Options(accident, fly);
      const trains = {
        [TrainType.C51]: sl.add_c51,
        [TrainType.D51]: sl.add_d51,
        [TrainType.LOGO]: sl.add_logo
      };

      const clear = () => {
        if (!terminal) {
          return;
        }
        for (const row of Array.from(terminal.children)) {
          row.textContent = '\xa0'.repeat(terminal.children[0].textContent.length);
        }
      };

      let x = terminal.children[0].textContent.length;
      setInterval(() => {
        let cols = terminal.children[0].textContent.length;
        let rows = terminal.children.length;
        let display = new sl.Display(cols, rows, (y, x, str) => {
          let row = terminal?.children[y];
          if (!row || !row.textContent) {
            return;
          }
          row.textContent = row.textContent.substring(0, x) + str + row.textContent.substring(x + str.length);
        });

        if (!trains[trainType](--x, messages, display, options)) {
          clear();
          x = cols;
        }
      }, 60);
    };

    runWasm();
  }, [accident, fly, trainType, messages]);

  return <Terminal title={title} terminalRef={terminalRef} />;
};

export { TrainType };
export default SlTerminal;
