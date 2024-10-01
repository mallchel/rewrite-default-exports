import { createRoot } from 'react-dom/client';

import { Root } from './Root';
import Num from '@ui/kit/Button/Button';
import * as allConst from './test-te-const';

console.log(allConst.default);

export const clientRun = () => {
  const content = document.getElementById('content');
  const s = import('./dynamicModule');
  // const s1 = import('https://google.com');

  const t = 'test-test-test';
  const test = allConst.default;
  const key = 'default';
  console.log(allConst[key], test);
  const root = createRoot(content);

  root.render(<Root />);
};

clientRun();

const t1 = './Root';

const LazyFieldSettings = React.lazy(() => {
  return import(t1);
});

// const t = 213;
// export default t;
// export default class {};
// export default class A {};
// export default function () {};
// export default function a() {};
