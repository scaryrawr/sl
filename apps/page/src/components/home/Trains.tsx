import type { CSSProperties } from 'preact';

import type { TrainTypeValue } from '../trainType';
import { SHOWCASE_MESSAGES, showcaseId, SHOWCASES } from './showcases';

const descriptions = {
  d51: {
    name: 'D51',
    description:
      'The D51 is the locomotive that runs when you type sl with no flags: a 2-8-2 Mikado engine eleven rows tall, ' +
      'a coal car, and a line of passenger cars that carry whatever you pipe in.'
  },
  c51: {
    name: 'C51',
    description:
      'Pass -c (or --c51) to swap the engine for the C51: a Pacific with a leading truck, a longer boiler, and ' +
      'twelve rows of art instead of eleven. The coal car and passenger cars trail along the same way.'
  },
  logo: {
    name: 'Logo',
    description:
      'The little version from -l (or --logo) is a seven-row train. It keeps the animation intact on narrow ' +
      'terminals and small embeds, where the full locomotives are clipped by the window.'
  }
} satisfies Record<TrainTypeValue, { name: string; description: string }>;

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
} satisfies Record<'demo' | 'copy' | 'terminal', CSSProperties>;

const TrainDemo = ({ trainType, command }: (typeof SHOWCASES)[number]) => {
  const { name, description } = descriptions[trainType];
  const headingId = `train-${trainType}`;

  const embedHref =
    `./embed.html?trainType=${encodeURIComponent(trainType)}&smoke=true` +
    `&messages=${encodeURIComponent(JSON.stringify(SHOWCASE_MESSAGES))}`;

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
      <div id={showcaseId(trainType)} style={styles.terminal} />
    </section>
  );
};

/**
 * "Trains" section: a live demo for every locomotive `sl` supports.
 *
 * The same three trains the CLI flags select (`-c` and `-l`, with D51 as the
 * default), each shown in its own terminal so the sprites can be compared directly.
 *
 * @returns The static trains section with a mount point for each live demo.
 */
const Trains = () => (
  <div>
    <h2>Trains</h2>
    <p>
      SL draws three trains. Pick one with a CLI flag, or with the <code>trainType</code> embed parameter - each demo
      below runs on its own.
    </p>
    {SHOWCASES.map((showcase) => (
      <TrainDemo key={showcase.trainType} {...showcase} />
    ))}
  </div>
);

export default Trains;
