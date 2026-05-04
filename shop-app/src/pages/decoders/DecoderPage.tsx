import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import CRMGreeting from 'components/sections/dashboards/crm/CRMGreeting';
import { dealsData } from 'data/crm/dashboard';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';
import DecoderInputPanel from './DecoderInputPanel';
import IbanezAdditionalInfoPanel from './IbanezAdditionalInfoPanel';
import DecoderFaqPanel from './DecoderFaqPanel';
import DecoderHowToPanel from './DecoderHowToPanel';

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
  const now = new Date();
  const currentAsOf = `${now.toLocaleString('en-US', { month: 'short' })}/${now.getFullYear()}`;

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
        <Grid size={12}>
          <CRMGreeting
            data={dealsData}
            singleColumn
            title={config.pageTitle}
            subtitle={config.brandDescriptionText}
            noteContent={
              <>
                <Box
                  component="span"
                  sx={{
                    '& p': { m: 0, display: 'inline' },
                    '& a': {
                      color: 'inherit',
                      textDecoration: 'underline',
                      textUnderlineOffset: '0.18em',
                    },
                    '& strong': { fontWeight: 600 },
                  }}
                  dangerouslySetInnerHTML={{ __html: config.noteHtml }}
                />
                <br />
                <Box
                  component="span"
                  sx={{
                    color: 'warning.main',
                    fontWeight: 600,
                  }}
                >
                  Our decoders are constantly being updated - Current as of {currentAsOf}
                </Box>
              </>
            }
          />
        </Grid>

        <Grid container size={12}>
          <Grid size={{ xs: 12, lg: 5, xl: 6 }}>
            <DecoderInputPanel
              brand={config.brandKey}
              brandDisplayName={config.brandName}
              onAdditionalInfoChange={setAdditionalInfoRichText}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 7, xl: 6 }}>
            <Grid container direction="column" rowSpacing={3}>
              {additionalInfoRichText && (
                <Grid size={12}>
                  <IbanezAdditionalInfoPanel richText={additionalInfoRichText} />
                </Grid>
              )}
              <Grid size={12}>
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
