import { useEffect } from 'react';
import Grid from '@mui/material/Grid';
import ActiveUsers from 'components/sections/dashboards/crm/active-users/ActiveUsers';
import CRMGreeting from 'components/sections/dashboards/crm/CRMGreeting';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';
import { dealsData } from 'data/crm/dashboard';
import IbanezFaqPanel from './IbanezFaqPanel';
import IbanezHowToPanel from './IbanezHowToPanel';

const IbanezDecoder = () => {
  useEffect(() => {
    document.title = 'Ibanez Guitar Serial Number Decoder';
  }, []);

  return (
    <DecoderPreviewLayout>
      <Grid container>
        <Grid size={12}>
          <CRMGreeting
            data={dealsData}
            singleColumn
            title="Ibanez Guitar Serial Number Lookup/Decoder"
            subtitle='Founded in 1908 as Hoshino Gakki, a Japanese bookstore chain that began importing Spanish guitars, Ibanez has evolved into a premier manufacturer of guitars, basses, and amplifiers. Known for high-performance instruments favored by rock and metal artists, the company is renowned for its "lawsuit era" copies in the 1970s, which led to iconic original designs like the JEM, RG, and S series.'
          />
        </Grid>

        <Grid container size={12}>
          <Grid size={{ xs: 12, lg: 5, xl: 6 }}>
            <ActiveUsers />
          </Grid>
          <Grid size={{ xs: 12, lg: 7, xl: 6 }}>
            <Grid container direction="column" rowSpacing={3}>
              <Grid size={12}>
                <IbanezFaqPanel />
              </Grid>
              <Grid size={12}>
                <IbanezHowToPanel />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </DecoderPreviewLayout>
  );
};

export default IbanezDecoder;
