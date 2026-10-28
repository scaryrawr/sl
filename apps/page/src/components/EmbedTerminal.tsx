import { useEffect } from 'preact/hooks';
import SlTerminal, { TrainType, type TrainTypeValue } from './slTerminal';

/**
 * Parse the `messages` query parameter into an array of strings.
 *
 * Expects a URL-encoded JSON array (e.g., `["hello","world"]`).
 * Returns an empty array if parsing fails.
 *
 * @param messagesParam - Raw query parameter value (URL-encoded JSON string) or `null`.
 * @returns Array of message strings to display on train cars.
 */
const parseMessages = (messagesParam: string | null): string[] => {
  try {
    return JSON.parse(decodeURIComponent(messagesParam ?? '[]')) as string[];
  } catch (error) {
    console.warn('Failed to parse messages parameter:', error);
    return [];
  }
};

/**
 * Standalone embeddable SL terminal component.
 *
 * Reads animation configuration from URL query parameters so the component can be
 * dropped into any page via an `<iframe>` or direct script include.
 *
 * Supported query parameters:
 * - `accident` – `"true"` to enable accident mode
 * - `fly` – `"true"` to enable flying mode
 * - `smoke` – any value other than `"false"` enables smoke (default: on)
 * - `trainType` – `"d51"`, `"c51"`, or `"logo"` (default: `"d51"`)
 * - `messages` – URL-encoded JSON array of strings
 * - `fontColor` – CSS color string (default: `#0f0`)
 * - `backgroundColor` – CSS color string (default: `#000`)
 *
 * The terminal fills the entire embed viewport, and the page background matches
 * `backgroundColor` so the iframe never shows letterboxing around the terminal window.
 *
 * @returns Configured {@link SlTerminal} driven by query parameters.
 */
const EmbedTerminal = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const accident = searchParams.get('accident') === 'true';
  const fly = searchParams.get('fly') === 'true';
  const smoke = searchParams.get('smoke') !== 'false';
  const trainType = (searchParams.get('trainType') as TrainTypeValue | null) ?? TrainType.D51;
  const messages = parseMessages(searchParams.get('messages'));
  // `||` so empty query params (e.g. `backgroundColor=`) fall back to the defaults
  const fontColor = searchParams.get('fontColor') || '#0f0';
  const backgroundColor = searchParams.get('backgroundColor') || '#000';

  // Keep the page background in sync with the terminal so the embed
  // never shows a mismatched (white) frame around the terminal window.
  useEffect(() => {
    document.documentElement.style.setProperty('--sl-background', backgroundColor);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', backgroundColor);
  }, [backgroundColor]);

  return (
    <SlTerminal
      title="SL"
      fill
      accident={accident}
      fly={fly}
      smoke={smoke}
      trainType={trainType}
      messages={messages}
      fontColor={fontColor}
      backgroundColor={backgroundColor}
    />
  );
};

export default EmbedTerminal;
