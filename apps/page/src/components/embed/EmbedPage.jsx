import { useSearchParams } from 'react-router-dom';
import SlTerminal, { TrainType } from '../slTerminal.jsx';

const EmbedPage = () => {
  const [searchParams] = useSearchParams();
  const accident = searchParams.get('accident') === 'true';
  const fly = searchParams.get('fly') === 'true';
  const smoke = searchParams.get('smoke') !== 'false';
  const trainType = searchParams.get('trainType') || TrainType.D51;
  const messages = JSON.parse(decodeURIComponent(searchParams.get('messages') || '[]'));

  return (
    <SlTerminal title="SL" accident={accident} fly={fly} smoke={smoke} trainType={trainType} messages={messages} />
  );
};

export default EmbedPage;
