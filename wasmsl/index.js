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
    str = str.replace(" ", "\xa0");
    row.textContent =
      row.textContent.substring(0, x) +
      str +
      row.textContent.substring(x + str.length, row.textContent.length);
    row.textContent += "\xa0".repeat(120 - row.textContent.length);
  });

  let x = 120;
  let id = setInterval(() => {
    if (!sl.add_c51(--x, ["hello", "world"], ["hello", "world"], display)) {
      clearInterval(id);
    }
  }, 70);
};

const terminal = document.getElementById("terminal");
for (let i = 0; i < 40; i++) {
  let row = document.createElement("div");
  row.textContent = "\xa0".repeat(120);
  terminal.appendChild(row);
}

runWasm();
