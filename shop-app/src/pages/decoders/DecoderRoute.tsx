import { useParams } from 'react-router';
import Page404 from 'pages/errors/Page404';
import DecoderPage, { DecoderConfig } from './DecoderPage';
import decoderConfigs from './decoder-configs.json';

// Loaded lazily from the router so the decoder configs (~300 KB) only download on decoder pages.
const DecoderRoute = () => {
  const { decoderSlug } = useParams();
  const config = (decoderConfigs as Array<DecoderConfig & { routePath: string }>).find(
    (entry) => entry.routePath === `/decoders/${decoderSlug}`,
  );
  return config ? <DecoderPage config={config} /> : <Page404 />;
};

export default DecoderRoute;
