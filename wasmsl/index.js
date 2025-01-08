// Import our outputted wasm ES6 module
// Which, export default's, an initialization function
import init from "./pkg/wasmsl.js";

const runWasm = async () => {
  // Instantiate our wasm module
  const sl = await init("./pkg/wasmsl_bg.wasm");
  sl.set_panic_hook();

  // Call the Add function export from wasm, save the result
  const terminal = document.getElementById("terminal");

  let display = sl.display_new(120, 40, (y, x, str) => {
    let row = terminal.children[y];
    row.textContent =
      row.textContent.substring(0, x) +
      str +
      row.textContent.substring(x + str.length);
  });

  const clear = () => {
    for (const row of terminal.children) {
      row.textContent = "\xa0".repeat(120);
    }
  };

  let x = 120;
  let train_index = 0;
  const trains = [sl.add_c51, sl.add_d51, sl.add_logo];
  setInterval(() => {
    if (!trains[train_index](--x, ["hello", "world"], display)) {
      clear();
      x = 120;
      train_index = (train_index + 1) % trains.length;
    }
  }, 60);
};

const terminal = document.getElementById("terminal");
for (let i = 0; i < 40; i++) {
  let row = document.createElement("div");
  row.textContent = "\xa0".repeat(120);
  terminal.appendChild(row);
}

runWasm();
