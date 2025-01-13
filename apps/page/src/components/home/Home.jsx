import { useState } from 'react';
import SlTerminal, { TrainType } from '../slTerminal.jsx';
import Embed from './Embed.jsx';
import Form from './Form.jsx';
import Installation from './Installation.jsx';
import Piping from './Piping.jsx';
import Usage from './Usage.jsx';

const Home = () => {
  const [accident, setAccident] = useState(true);
  const [fly, setFly] = useState(false);
  const [smoke, setSmoke] = useState(true);
  const [trainType, setTrainType] = useState(TrainType.D51);
  const [messages, setMessages] = useState(['hello', 'world']);
  const [fontColor, setFontColor] = useState('#0f0');
  const [backgroundColor, setBackgroundColor] = useState('#000');

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h1>Welcome to the SL Project</h1>
      <p>
        SL (Steam Locomotive) runs across your terminal when you type "sl" as you meant to type "ls". It's just a joke
        command.
      </p>
      <p>
        Visit our <a href="https://github.com/scaryrawr/sl">GitHub repository</a> for more information.
      </p>
      <hr />
      <h2>Demo</h2>
      <div style={{ display: 'flex', gap: '20px' }}>
        <Form
          accident={accident}
          setAccident={setAccident}
          fly={fly}
          setFly={setFly}
          smoke={smoke}
          setSmoke={setSmoke}
          trainType={trainType}
          setTrainType={setTrainType}
          messages={messages}
          setMessages={setMessages}
          fontColor={fontColor}
          setFontColor={setFontColor}
          backgroundColor={backgroundColor}
          setBackgroundColor={setBackgroundColor}
        />
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
      </div>
      <Usage />
      <Piping />
      <Embed />
      <Installation />
    </div>
  );
};

export default Home;
