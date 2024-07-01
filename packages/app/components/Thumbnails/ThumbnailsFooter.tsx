import { ReactNode } from 'react';

import { UiComponent } from '@ui/kit';

export const ThumbnailsFooter = ({ children }: { children: ReactNode }) => {
  return (
    <div>
      <UiComponent />
      ThumbnailsFooter
      {children}
    </div>
  );
};
