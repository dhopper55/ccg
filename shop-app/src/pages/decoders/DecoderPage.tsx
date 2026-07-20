import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';
import DecoderInputPanel from './DecoderInputPanel';
import EvalPitchPanel from './EvalPitchPanel';
import EmailSignupPanel from './EmailSignupPanel';
import DecoderFaqPanel from './DecoderFaqPanel';
import DecoderHowToPanel from './DecoderHowToPanel';
import DecoderSlot from './DecoderSlot';
import GoogleReviewPanel from './GoogleReviewPanel';

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
      {/*
        Single flat, order-controlled grid so item sequence can differ between
        mobile (stacked) and desktop (two-column) layouts without duplicating
        stateful panels. Desktop pairs items row-by-row (5+7 / 6+6 = 12 per
        row) in `lg` order; mobile uses `xs` order for a single vertical flow.
      */}
      <Grid container rowSpacing={3}>
        <Grid size={{ xs: 12, lg: 5, xl: 6 }} sx={{ order: { xs: 1, lg: 1 } }}>
          <DecoderInputPanel
            brand={config.brandKey}
            brandDisplayName={config.brandName}
            additionalInfoRichText={additionalInfoRichText}
            onAdditionalInfoChange={setAdditionalInfoRichText}
            onDecodeSuccess={setDecodeSuccess}
          />
        </Grid>

        {decodeSuccess && (
          <Grid size={{ xs: 12, lg: 7, xl: 6 }} sx={{ order: { xs: 2, lg: 2 } }}>
            <GoogleReviewPanel />
          </Grid>
        )}

        {decodeSuccess && (
          <Grid size={{ xs: 12, lg: 5, xl: 6 }} sx={{ order: { xs: 3, lg: 5 } }}>
            <EmailSignupPanel />
          </Grid>
        )}

        {decodeSuccess && (
          <Grid size={{ xs: 12, lg: 5, xl: 6 }} sx={{ order: { xs: 4, lg: 3 } }}>
            <EvalPitchPanel
              brand={config.brandName}
              year={decodeSuccess.year}
              serial={decodeSuccess.serial}
              decodeEventId={decodeSuccess.decodeEventId ?? null}
            />
          </Grid>
        )}

        <Grid size={{ xs: 12, lg: 7, xl: 6 }} sx={{ order: { xs: 5, lg: 4 } }}>
          <DecoderSlot brand={config.brandKey} name="aboveFaq" />
          <DecoderFaqPanel title={config.faqTitle} items={config.faqItems} />
        </Grid>

        <Grid size={{ xs: 12, lg: 7, xl: 6 }} sx={{ order: { xs: 6, lg: 6 } }}>
          <DecoderHowToPanel title={config.howToTitle} html={config.howToHtml} />
        </Grid>
      </Grid>
    </DecoderPreviewLayout>
  );
};

export default DecoderPage;
