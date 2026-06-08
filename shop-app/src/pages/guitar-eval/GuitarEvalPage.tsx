import { Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import MainLayout from 'layouts/main-layout';
import AddContactStepper from 'components/sections/crm/add-contact/AddContactStepper';
import PageHeader from 'components/sections/ecommerce/admin/common/PageHeader';

const GuitarEvalPage = () => {
  return (
    <MainLayout>
      <Grid container>
        <Grid size={12}>
          <PageHeader
            title="$ Coal Creek Guitar Evaluation Report"
            breadcrumb={[
              { label: 'Home', url: 'https://www.coalcreekguitars.com' },
              { label: 'Guitar Evaluation', active: true },
            ]}
          />
        </Grid>
        <Grid size={12}>
          <Paper sx={{ p: { xs: 3, md: 5 } }}>
            <AddContactStepper />
          </Paper>
        </Grid>
      </Grid>
    </MainLayout>
  );
};

export default GuitarEvalPage;
