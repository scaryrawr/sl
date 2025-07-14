import { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { osName } from 'react-device-detect';

const styles = {
  window: {
    border: '1px solid black',
    borderRadius: '5px',
    width: '100%',
    maxHeight: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    margin: '20px auto',
    backgroundColor: '#fff'
  },
  titleBar: {
    backgroundColor: '#333',
    color: '#fff',
    padding: '5px',
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontWeight: 'bold'
  },
  buttons: {
    display: 'flex',
    gap: '5px'
  },
  button: {
    backgroundColor: '#555',
    color: '#fff',
    border: 'none',
    borderRadius: '3px',
    width: '20px',
    height: '20px',
    cursor: 'pointer'
  },
  terminal: {
    fontFamily: 'monospace',
    whiteSpace: 'pre',
    flex: 1,
    padding: '10px',
    overflow: 'auto',
    maxHeight: 'calc(80vh - 50px)'
  }
};

const MacWindowChrome = lazy(() => import('./MacWindowChrome.jsx'));
const WindowsWindowChrome = lazy(() => import('./WindowsWindowChrome.jsx'));
const LinuxWindowChrome = lazy(() => import('./LinuxWindowChrome.jsx'));

function detectColorScheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

const Terminal = ({ title, terminalRef: externalRef, fontColor = '#0f0', backgroundColor = '#000' }) => {
  const [colorScheme, setColorScheme] = useState(detectColorScheme());

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => setColorScheme(e.matches ? 'dark' : 'light');
      mql.addEventListener ? mql.addEventListener('change', handler) : mql.addListener(handler);
      return () => {
        mql.removeEventListener ? mql.removeEventListener('change', handler) : mql.removeListener(handler);
      };
    }
  }, []);

  let ChromeComponent;
  if (osName === 'Mac OS') {
    ChromeComponent = MacWindowChrome;
  } else if (osName === 'Windows') {
    ChromeComponent = WindowsWindowChrome;
  } else if (osName === 'Linux') {
    ChromeComponent = LinuxWindowChrome;
  } else {
    ChromeComponent = MacWindowChrome; // fallback
  }

  const internalRef = useRef(null);
  const terminalRef = externalRef || internalRef;
  const [dimensions, setDimensions] = useState({ rows: 40, cols: 120 });

  useEffect(() => {
    const terminal = terminalRef.current;

    const updateDimensions = () => {
      if (terminal) {
        const tempElement = document.createElement('div');
        tempElement.style.position = 'absolute';
        tempElement.style.visibility = 'hidden';
        tempElement.style.whiteSpace = 'pre';
        tempElement.textContent = 'X';
        terminal.appendChild(tempElement);

        const charWidth = tempElement.getBoundingClientRect().width;
        const lineHeight = tempElement.getBoundingClientRect().height;

        terminal.removeChild(tempElement);

        const { clientWidth, clientHeight } = terminal;
        const cols = Math.floor(clientWidth / charWidth);
        const rows = Math.min(80, Math.floor(clientHeight / lineHeight));
        setDimensions({ rows, cols });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(terminal);

    updateDimensions();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.innerHTML = '';
      for (let i = 0; i < dimensions.rows; i++) {
        let row = document.createElement('div');
        row.textContent = '\xa0'.repeat(dimensions.cols);
        terminal.appendChild(row);
      }
    }
  }, [dimensions]);

  const terminalStyle = useMemo(
    () => ({
      ...styles.terminal,
      color: fontColor,
      backgroundColor: backgroundColor
    }),
    [fontColor, backgroundColor]
  );

  return (
    <Suspense fallback={<div>Loading terminal window...</div>}>
      <ChromeComponent title={title} colorScheme={colorScheme}>
        <div ref={terminalRef} style={terminalStyle}></div>
      </ChromeComponent>
    </Suspense>
  );
};

export default Terminal;
