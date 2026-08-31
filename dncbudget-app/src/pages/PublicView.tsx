import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

interface AnalysisData {
  totalIn: number | null;
  incomeBreakdown: { source: string; amount: number }[];
  categories: string[];
}

const SECTION_PREVIEWS = [
  {
    title: "Safe to Spend",
    body: "The number that actually matters — what's left to spend this month after bills and everything already spent. Updates as things post, all month long.",
  },
  {
    title: "Categories",
    body: "Everyday spending gets sorted into buckets automatically once I've seen a merchant a time or two — no manual tagging after the first pass.",
  },
  {
    title: "Expected Bills",
    body: "Mortgage, car payment, the recurring stuff — counted against the budget the moment the month starts, whether or not it's posted yet.",
  },
  {
    title: "Check-ins",
    body: "A few texts a day, and a heads-up the moment something's worth knowing about — a big purchase, a nice refund, anything in between.",
  },
];

const PublicView = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");

  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("missing_token");
      setLoading(false);
      return;
    }
    fetch(`/api/dncbudget/public/analysis?t=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.ok) throw new Error(body.error || "not_found");
        setData(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "not_found"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F7F8FA", py: { xs: 4, sm: 8 } }}>
      <Container maxWidth="sm">
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                This link isn't valid anymore.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ask David for a fresh one.
              </Typography>
            </CardContent>
          </Card>
        )}

        {!loading && data && (
          <Stack spacing={3}>
            <Box>
              <Typography variant="overline" color="primary" fontWeight={700}>
                Hi, I'm Sunshine
              </Typography>
              <Typography variant="h4" fontWeight={800} gutterBottom>
                Starting September 1st, I'm on it.
              </Typography>
              <Typography variant="body1" color="text.secondary">
                No data yet — that starts tomorrow. Here's what I'll actually be tracking for you two, and the
                one number that already matters.
              </Typography>
            </Box>

            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" fontWeight={700}>
                    Expected incoming funds
                  </Typography>
                  <Chip label="September" size="small" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  This is the total we're counting on this month — the number everything else can't exceed.
                </Typography>
                <Table size="small">
                  <TableBody>
                    {data.incomeBreakdown.map((row) => (
                      <TableRow key={row.source}>
                        <TableCell sx={{ border: 0, pl: 0 }}>{row.source}</TableCell>
                        <TableCell align="right" sx={{ border: 0, pr: 0 }}>
                          ${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Divider sx={{ my: 1.5 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="subtitle1" fontWeight={700}>
                    Total In
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {data.totalIn !== null
                      ? `$${data.totalIn.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                      : "—"}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>

            <Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                What's coming
              </Typography>
              <Stack spacing={2}>
                {SECTION_PREVIEWS.map((s) => (
                  <Card key={s.title} variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                        {s.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.body}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>

            {data.categories.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Categories I'm starting with:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {data.categories.map((c) => (
                    <Chip key={c} label={c} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Container>
    </Box>
  );
};

export default PublicView;
