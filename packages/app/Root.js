import { createRoot } from 'react-dom/client';

import { UiComponent, UiComponent2 } from '@ui/kit';
import { Button } from '@ui/kit/Button/Button';

import ApplicationRename, { SomeThingElse } from './components/Application';
import { ApplicationMobile } from './components/Application/ApplicationMobile';
import { ApplicationUnused } from './components/Application/ApplicationUnused';
import { ApplicationProvider } from './components/Application/ApplicationProvider';
import DocumentService from './services/DocumentService';
import PassedToPropsTest from './components/Application/PassedToProps';
import WithoutJsx from './components/WithoutJsx';
import { Portal } from './components';
import { TestEnum, TestEnum2 } from './test-te-const';
import { Test } from '../Test';
import * as all from './test-te-const';
import Const from './test-te-const';
import { constDefault } from './constNew';

export const Root = ({
  isSigningSessionOrViewOnlyOnPhone,
  isConstructorOnPhone,
  isConstructorLoaded,
}) => {
  console.log('render', all.default, import('./components/Make-Payment-Provider'));

  return (
    <ApplicationProvider>
      {({ onApplicationLoad }) => {
        return (
          <>
            <UiComponent component={PassedToPropsTest} />
            <UiComponent2 arg={TestEnum.one} arg2={TestEnum2.two} />
            <Button />
            <Portal />
            <SomeThingElse />
            <Test />

            {isSigningSessionOrViewOnlyOnPhone || (isConstructorOnPhone && isConstructorLoaded) ? (
              <ApplicationMobile onLoad={onApplicationLoad} />
            ) : (
              <ApplicationRename onLoad={onApplicationLoad} />
            )}
          </>
        );
      }}
    </ApplicationProvider>
  );
};

export { Test as default };
