import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';
import DecoderInputPanel from './DecoderInputPanel';
import EvalPitchPanel from './EvalPitchPanel';
import DecoderFaqPanel from './DecoderFaqPanel';
import DecoderHowToPanel from './DecoderHowToPanel';
import DecoderSlot from './DecoderSlot';

interface DecoderFaqItem {
  question: string;
  answerHtml: string;
}

export interface DecoderConfig {
  brandKey: string;
  brandName: string;
  logoSrc: string;
  pageTitle: string;
  title: string;
  brandDescriptionText: string;
  noteHtml: string;
  faqTitle: string;
  faqItems: DecoderFaqItem[];
  howToTitle: string;
  howToHtml: string;
}

interface DecoderPageProps {
  config: DecoderConfig;
}

const DecoderPage = ({ config }: DecoderPageProps) => {
  const [additionalInfoRichText, setAdditionalInfoRichText] = useState('');
  const [decodeSuccess, setDecodeSuccess] = useState<{ serial: string; decodeEventId: number | null; year?: string } | null>(null);

  useEffect(() => {
    document.title = config.pageTitle;
  }, [config.pageTitle]);

  return (
    <DecoderPreviewLayout
      activeDecoderName={config.brandName}
      headerLogoSrc={config.logoSrc}
      headerLogoAlt={config.brandName}
    >
      <Grid container>
        <Grid container size={12}>
          <Grid size={{ xs: 12, lg: 5, xl: 6 }}>
            <DecoderInputPanel
              brand={config.brandKey}
              brandDisplayName={config.brandName}
              additionalInfoRichText={additionalInfoRichText}
              onAdditionalInfoChange={setAdditionalInfoRichText}
              onDecodeSuccess={setDecodeSuccess}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 7, xl: 6 }}>
            <Grid container direction="column" rowSpacing={3}>
              {decodeSuccess && (
                <Grid size={12}>
                  <EvalPitchPanel
                    brand={config.brandName}
                    year={decodeSuccess.year}
                    serial={decodeSuccess.serial}
                    decodeEventId={decodeSuccess.decodeEventId}
                  />
                </Grid>
              )}
              <Grid size={12}>
                <DecoderSlot brand={config.brandKey} name="aboveFaq" />
                <DecoderFaqPanel title={config.faqTitle} items={config.faqItems} />
              </Grid>
              <Grid size={12}>
                <DecoderHowToPanel title={config.howToTitle} html={config.howToHtml} />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </DecoderPreviewLayout>
  );
};

export default DecoderPage;
