import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import Grid from '@mui/material/Grid';
import ActiveUsers from 'components/sections/dashboards/crm/active-users/ActiveUsers';
import CRMGreeting from 'components/sections/dashboards/crm/CRMGreeting';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';
import { dealsData } from 'data/crm/dashboard';
import IbanezAdditionalInfoPanel from './IbanezAdditionalInfoPanel';
import FenderFaqPanel from './FenderFaqPanel';
import FenderHowToPanel from './FenderHowToPanel';
import DecoderSlot from './DecoderSlot';

const FenderDecoder = () => {
  const [additionalInfoRichText, setAdditionalInfoRichText] = useState('');
  const now = new Date();
  const currentAsOf = `${now.toLocaleString('en-US', { month: 'short' })}/${now.getFullYear()}`;

  useEffect(() => {
    document.title = 'Fender Guitar Serial Number Decoder';
  }, []);

  return (
    <DecoderPreviewLayout
      activeDecoderName="Fender"
      headerLogoSrc="/images/brand-logos/Fender-logo.jpg"
      headerLogoAlt="Fender"
    >
      <Grid container>
        <Grid size={12}>
          <CRMGreeting
            data={dealsData}
            singleColumn
            title="Fender Guitar Serial Number Lookup/Decoder"
            subtitle="Founded in 1946 by Leo Fender in Fullerton, California, Fender Musical Instruments Corporation (FMIC) is the world's leading manufacturer of stringed instruments, amplifiers, and accessories. Renowned for creating the first mass-produced solid-body electric guitars, including the Telecaster and Stratocaster, Fender is a cornerstone of modern music."
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
              brand="fender"
              brandDisplayName="Fender"
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
                <DecoderSlot brand="fender" name="aboveFaq" />
                <FenderFaqPanel />
              </Grid>
              <Grid size={12}>
                <FenderHowToPanel />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </DecoderPreviewLayout>
  );
};

export default FenderDecoder;
