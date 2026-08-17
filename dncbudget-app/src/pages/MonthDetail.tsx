import { useSearchParams } from "react-router";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import MainLayout from "layouts/MainLayout";

const MonthDetail = () => {
  const [searchParams] = useSearchParams();
  const month = searchParams.get("month") ?? "unknown";

  return (
    <MainLayout>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {month}
      </Typography>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Transaction grid for this month goes here once the data layer's built.
        </Typography>
      </Paper>
    </MainLayout>
  );
};

export default MonthDetail;
