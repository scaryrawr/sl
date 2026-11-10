/** @jsxImportSource preact */
import { options, render } from 'preact';

import SlTerminal from '../../../../apps/page/src/components/slTerminal';

export function mount(withSecondTrain: boolean) {
  // Flush effect setup without putting Preact's scheduler in the animation queue.
  options.requestAnimationFrame = queueMicrotask;

  const first = document.createElement('div');
  first.id = 'train-a';
  first.style.width = '630px';
  document.body.appendChild(first);

  render(
    <SlTerminal
      title="Train A"
      trainType="d51"
      accident={false}
      fly={false}
      smoke
      messages={['TWIN-A']}
    />,
    first
  );

  if (withSecondTrain) {
    const second = document.createElement('div');
    second.id = 'train-b';
    second.style.cssText = 'width:630px;position:absolute;left:640px;top:0';
    document.body.appendChild(second);

    render(
      <SlTerminal
        title="Train B"
        trainType="logo"
        accident={false}
        fly={false}
        smoke
        messages={['TWIN-B']}
      />,
      second
    );
  }
}
