import { createRoot } from 'react-dom/client';
import SlTerminal, { TrainType, type TrainTypeValue } from './components/slTerminal';

const parseMessages = (messagesParam: string | null): string[] => {
  try {
    return JSON.parse(decodeURIComponent(messagesParam ?? '[]')) as string[];
  } catch (error) {
    console.warn('Failed to parse messages parameter:', error);
    return [];
  }
};

const EmbedApp = () => {
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

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

createRoot(container).render(<EmbedApp />);
