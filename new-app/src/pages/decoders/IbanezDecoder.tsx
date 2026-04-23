import { useEffect } from 'react';
import CRM from 'pages/dashboards/CRM';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';

const IbanezDecoder = () => {
  useEffect(() => {
    document.title = 'Ibanez Guitar Serial Number Decoder';
  }, []);

  return (
    <DecoderPreviewLayout>
      <CRM />
    </DecoderPreviewLayout>
  );
};

export default IbanezDecoder;
