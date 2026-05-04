import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import ActiveUsers from 'components/sections/dashboards/crm/active-users/ActiveUsers';
import CRMGreeting from 'components/sections/dashboards/crm/CRMGreeting';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';
import { dealsData } from 'data/crm/dashboard';
import IbanezAdditionalInfoPanel from './IbanezAdditionalInfoPanel';
import GibsonFaqPanel from './GibsonFaqPanel';
import GibsonHowToPanel from './GibsonHowToPanel';

const GibsonDecoder = () => {
  const [additionalInfoRichText, setAdditionalInfoRichText] = useState('');
  const now = new Date();
  const currentAsOf = `${now.toLocaleString('en-US', { month: 'short' })}/${now.getFullYear()}`;

  useEffect(() => {
    document.title = 'Gibson Guitar Serial Number Decoder';
  }, []);

  return (
    <DecoderPreviewLayout
      activeDecoderName="Gibson"
      headerLogoSrc="/images/brand-logos/Gibson-logo.png"
      headerLogoAlt="Gibson"
    >
      <Grid container>
        <Grid size={12}>
          <CRMGreeting
            data={dealsData}
            singleColumn
            title="Gibson Guitar Serial Number Lookup/Decoder"
            subtitle="The Gibson Guitar Corporation (now known as Gibson Brands, Inc.) is an iconic American manufacturer of musical instruments, best known for its influential electric and acoustic guitars like the Les Paul model. Founded in 1894 and headquartered in Nashville, Tennessee, the company has a long history of craftsmanship and musical innovation."
            noteContent={
              <>
                {'Note: If you try a serial number and the decoder is not able to decode it, please '}
                <Box
                  component="a"
                  href="https://www.coalcreekguitars.com/contact-us"
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    color: 'inherit',
                    textDecoration: 'underline',
                    textUnderlineOffset: '0.18em',
                  }}
                >
                  contact us
                </Box>
                {' and let us know so we can check the number and fix the decoder. '}
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
            <ActiveUsers
              brand="gibson"
              brandDisplayName="Gibson"
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
                <GibsonFaqPanel />
              </Grid>
              <Grid size={12}>
                <GibsonHowToPanel />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </DecoderPreviewLayout>
  );
};

export default GibsonDecoder;
