import React, { ComponentType } from 'react';
import { Button } from './Button/Button';

export const UiComponent = ({ component: Component }: { component?: ComponentType }) => {
  return (
    <>
      uiComponent
      <Button />
      {Component && <Component />}
    </>
  );
};
export const UiComponent2 = ({ component: Component }: { component?: ComponentType }) => {
  return (
    <>
      uiComponent2
      <Button />
      <Button />
      <Button />
      {Component && <Component />}
    </>
  );
};
