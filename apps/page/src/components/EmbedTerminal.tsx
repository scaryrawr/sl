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
 * @returns Configured {@link SlTerminal} driven by query parameters.
 */
const EmbedTerminal = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const accident = searchParams.get('accident') === 'true';
  const fly = searchParams.get('fly') === 'true';
  const smoke = searchParams.get('smoke') !== 'false';
  const trainType = (searchParams.get('trainType') as TrainTypeValue | null) ?? TrainType.D51;
  const messages = parseMessages(searchParams.get('messages'));
  const fontColor = searchParams.get('fontColor') ?? '#0f0';
  const backgroundColor = searchParams.get('backgroundColor') ?? '#000';

  return (
    <SlTerminal
      title="SL"
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
