import React from 'react';
import { createRoot } from 'react-dom/client';
import Terminal from './components/terminal.jsx';

const runWasm = async () => {
  const sl = await import('websl');
  // Instantiate our wasm module
  sl.set_panic_hook();

  // Call the Add function export from wasm, save the result
  const terminal = document.getElementById('terminal');
  if (!terminal) {
    return;
  }

  let options = new sl.Options(true, false);

  const clear = () => {
    if (!terminal) {
      return;
    }
    for (const row of Array.from(terminal.children)) {
      row.textContent = '\xa0'.repeat(terminal.children[0].textContent.length);
    }
  };

  let x = 120;
  let train_index = 0;
  const trains = [sl.add_c51, sl.add_d51, sl.add_logo];
  setInterval(() => {
    let display = new sl.Display(terminal.children[0].textContent.length, terminal.children.length, (y, x, str) => {
      let row = terminal?.children[y];
      if (!row || !row.textContent) {
        return;
      }
      row.textContent = row.textContent.substring(0, x) + str + row.textContent.substring(x + str.length);
    });
    
    if (!trains[train_index](--x, ['hello', 'world'], display, options)) {
      clear();
      x = 120;
      train_index = (train_index + 1) % trains.length;
    }
  }, 60);
};

runWasm();
createRoot(document.getElementById('root')).render(<Terminal title="SL" />);
