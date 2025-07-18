import { useSearchParams } from 'react-router-dom';
import SlTerminal, { TrainType } from '../slTerminal.jsx';

const parseMessages = (messagesParam) => {
  try {
    return JSON.parse(decodeURIComponent(messagesParam || '[]'));
  } catch (error) {
    console.warn('Failed to parse messages parameter:', error);
    return [];
  }
};

const EmbedPage = () => {
  const [searchParams] = useSearchParams();
  const accident = searchParams.get('accident') === 'true';
  const fly = searchParams.get('fly') === 'true';
  const smoke = searchParams.get('smoke') !== 'false';
  const trainType = searchParams.get('trainType') || TrainType.D51;
  const messages = parseMessages(searchParams.get('messages'));
  const fontColor = searchParams.get('fontColor') || '#0f0';
  const backgroundColor = searchParams.get('backgroundColor') || '#000';

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

export default EmbedPage;
