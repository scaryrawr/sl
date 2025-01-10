const runWasm = async () => {
  const sl = await import('websl');
  // Instantiate our wasm module
  sl.set_panic_hook();

  // Call the Add function export from wasm, save the result
  const terminal = document.getElementById('terminal');
  if (!terminal) {
    return;
  }

  let display = new sl.Display(120, 40, (y, x, str) => {
    let row = terminal?.children[y];
    if (!row || !row.textContent) {
      return;
    }
    row.textContent = row.textContent.substring(0, x) + str + row.textContent.substring(x + str.length);
  });

  let options = new sl.Options(true, false);

  const clear = () => {
    if (!terminal) {
      return;
    }
    for (const row of Array.from(terminal.children)) {
      row.textContent = '\xa0'.repeat(120);
    }
  };

  let x = 120;
  let train_index = 0;
  const trains = [sl.add_c51, sl.add_d51, sl.add_logo];
  setInterval(() => {
    if (!trains[train_index](--x, ['hello', 'world'], display, options)) {
      clear();
      x = 120;
      train_index = (train_index + 1) % trains.length;
    }
  }, 60);
};

const terminal = document.getElementById('terminal');
if (terminal) {
  for (let i = 0; i < 40; i++) {
    let row = document.createElement('div');
    row.textContent = '\xa0'.repeat(120);
    terminal.appendChild(row);
  }
}

runWasm();
