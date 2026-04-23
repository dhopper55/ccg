import { useEffect } from 'react';
import Grid from '@mui/material/Grid';
import AcquisitionCost from 'components/sections/dashboards/crm/acquisition-cost/AcquisitionCost';
import ActiveUsers from 'components/sections/dashboards/crm/active-users/ActiveUsers';
import AvgLifetimeValue from 'components/sections/dashboards/crm/avg-lifetime-value/AvgLifetimeValue';
import CRMGreeting from 'components/sections/dashboards/crm/CRMGreeting';
import CustomerFeedback from 'components/sections/dashboards/crm/customer-feedback/CustomerFeedback';
import CRMGeneratedRevenue from 'components/sections/dashboards/crm/generated-revenue/CRMGeneratedRevenue';
import CRMKPIs from 'components/sections/dashboards/crm/kpi/CRMKPIs';
import LeadSources from 'components/sections/dashboards/crm/lead-sources/LeadSources';
import SaleFunnel from 'components/sections/dashboards/crm/sale-funnel/SaleFunnel';
import DecoderPreviewLayout from 'layouts/decoder-layout/DecoderPreviewLayout';
import { dealsData, kpisData } from 'data/crm/dashboard';

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
            subtitle='Founded in 1908 as Hoshino Gakki, a Japanese bookstore chain that began importing Spanish guitars, Ibanez has evolved into a premier manufacturer of guitars, basses, and amplifiers. Known for high-performance instruments favored by rock and metal artists, the company is renowned for its "lawsuit era" copies in the 1970s, which led to iconic original designs like the JEM, RG, and S series.'
            ctaLabel="How to decode an Ibanez serial #"
          />
        </Grid>

        <Grid container size={12}>
          <Grid container size={{ xs: 12, lg: 5, xl: 6 }}>
            <CRMKPIs data={kpisData} />
          </Grid>
          <Grid size={{ xs: 12, lg: 7, xl: 6 }}>
            <CRMGeneratedRevenue />
          </Grid>
        </Grid>

        <Grid container size={12}>
          <Grid container size={{ xs: 12, xl: 8 }}>
            <Grid container size={12}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomerFeedback />
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <LeadSources />
              </Grid>
            </Grid>

            <Grid size={12}>
              <AcquisitionCost />
            </Grid>
          </Grid>

          <Grid size={{ xs: 12, xl: 4 }}>
            <SaleFunnel />
          </Grid>
        </Grid>

        <Grid container size={12}>
          <Grid size={{ xs: 12, md: 6, xl: 4 }}>
            <AvgLifetimeValue />
          </Grid>
          <Grid size={{ xs: 12, md: 6, xl: 8 }}>
            <ActiveUsers />
          </Grid>
        </Grid>
      </Grid>
    </DecoderPreviewLayout>
  );
};

export default IbanezDecoder;
