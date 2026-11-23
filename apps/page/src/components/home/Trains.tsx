import type { JSX } from 'preact';

import SlTerminal, { TrainType, type TrainTypeValue } from '../slTerminal';

/**
 * One supported train plus the copy shown next to its live demo.
 */
type TrainDemoProps = {
  /** Train identifier passed to {@link SlTerminal} and to the embed page. */
  trainType: TrainTypeValue;
  /** Heading for the section, e.g. `C51`. */
  name: string;
  /** Command line that runs this train, shown as the terminal title. */
  command: string;
  /** What makes this train different from the others. */
  description: string;
};

/** Height of a showcase terminal: tall enough for the 12-row C51 engine and its smoke. */
const DEMO_HEIGHT = '480px';

/**
 * Passenger-car labels shared by every showcase.
 *
 * The wasm bridge caches parsed labels by array identity, so the three demos pass
 * this one module-level array instead of a fresh literal, and the labels also stay
 * identical across trains so the sprites are easy to compare side by side.
 */
const DEMO_MESSAGES = ['steam', 'locomotive'];

/** Every train `sl` draws, in the order they are introduced on the page. */
const TRAIN_DEMOS: TrainDemoProps[] = [
  {
    trainType: TrainType.D51,
    name: 'D51',
    command: 'sl',
    description:
      'The D51 is the locomotive that runs when you type sl with no flags: a Decapod engine eleven rows tall, ' +
      'a coal car, and a line of passenger cars that carry whatever you pipe in.'
  },
  {
    trainType: TrainType.C51,
    name: 'C51',
    command: 'sl -c',
    description:
      'Pass -c (or --c51) to swap the engine for the C51: a Pacific with a leading truck, a longer boiler, and ' +
      'twelve rows of art instead of eleven. The coal car and passenger cars trail along the same way.'
  },
  {
    trainType: TrainType.LOGO,
    name: 'Logo',
    command: 'sl -l',
    description:
      'The little version from -l (or --logo) is a seven-row train. It keeps the animation intact on narrow ' +
      'terminals and small embeds, where the full locomotives are clipped by the window.'
  }
];

const styles = {
  demo: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: '20px',
    marginBottom: '30px'
  },
  copy: {
    flex: '0 1 300px',
    minWidth: '240px'
  },
  terminal: {
    flex: '1 1 480px',
    minWidth: 0
  }
} satisfies Record<'demo' | 'copy' | 'terminal', JSX.CSSProperties>;

/**
 * One train section: its description next to a terminal running that train.
 *
 * Every demo animates on its own, with smoke on and accident off, so the only
 * difference a reader sees between sections is the locomotive itself.
 *
 * @param props - Train identifier and section copy.
 * @returns A labelled section with a compact animated terminal.
 */
const TrainDemo = ({ trainType, name, command, description }: TrainDemoProps) => {
  const headingId = `train-${trainType}`;

  const embedHref =
    `./embed.html?trainType=${encodeURIComponent(trainType)}&smoke=true` +
    `&messages=${encodeURIComponent(JSON.stringify(DEMO_MESSAGES))}`;

  return (
    <section style={styles.demo} aria-labelledby={headingId}>
      <div style={styles.copy}>
        <h3 id={headingId}>{name}</h3>
        <p>{description}</p>
        <p>
          Run it with <code>{command}</code>.
        </p>
        <p>
          <a
            href={embedHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${name} full-screen demo (opens in new tab)`}
          >
            Open the {name} full-screen demo
          </a>
        </p>
      </div>
      <div style={styles.terminal}>
        <SlTerminal
          title={command}
          accident={false}
          fly={false}
          smoke
          trainType={trainType}
          messages={DEMO_MESSAGES}
          height={DEMO_HEIGHT}
        />
      </div>
    </section>
  );
};

/**
 * "Trains" section: a live demo for every locomotive `sl` supports.
 *
 * The same three trains the CLI flags select (`-c` and `-l`, with D51 as the
 * default), each shown in its own terminal so the sprites can be compared directly.
 *
 * @returns The trains section with one animated demo per supported train.
 */
const Trains = () => (
  <div>
    <h2>Trains</h2>
    <p>
      SL draws three trains. Pick one with a CLI flag, or with the <code>trainType</code> embed parameter - each demo
      below runs on its own.
    </p>
    {TRAIN_DEMOS.map((demo) => (
      <TrainDemo
        key={demo.trainType}
        trainType={demo.trainType}
        name={demo.name}
        command={demo.command}
        description={demo.description}
      />
    ))}
  </div>
);

export default Trains;
