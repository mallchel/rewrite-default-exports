import Grid from '@ui/kit/Grid/Grid';

import { Thumbnails, ThumbnailsNavigationProvider } from '../Thumbnails';
import { Modals } from '../../components';

const Application = () => {
  return (
    <ThumbnailsNavigationProvider>
      <Thumbnails>
        <Grid>Logic</Grid>
        <Modals />
      </Thumbnails>
    </ThumbnailsNavigationProvider>
  );
};

export default Application;

export const SomeThingElse = () => {
  return <div>someThingElse</div>;
};
