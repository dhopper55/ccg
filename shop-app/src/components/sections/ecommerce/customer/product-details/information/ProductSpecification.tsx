import { Chip, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { List } from '@mui/material';
import { kebabCase } from 'lib/utils';

interface ProductSpecificationProps {
  specifications: { label: string; value?: string; values?: string[] }[];
}

const ProductSpecification = ({ specifications }: ProductSpecificationProps) => {
  return (
    <div>
      <Typography
        variant="h6"
        sx={{
          mb: 3,
        }}
      >
        Specification
      </Typography>
      <List dense disablePadding>
        {specifications.map(({ label, value, values }) => (
          <ListItem
            key={kebabCase(label)}
            disablePadding
            disableGutters
            sx={{ mb: 2, '&:last-of-type': { mb: 0 } }}
          >
            <ListItemText
              disableTypography
              sx={{ m: 0 }}
              primary={
                <Stack
                  sx={{
                    gap: 2,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      minWidth: 128,
                    }}
                  >
                    {label}
                  </Typography>
                  <Typography
                    component="div"
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    {values?.length ? (
                      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                        {values.map((item) => (
                          <Chip key={item} size="small" variant="outlined" label={item} />
                        ))}
                      </Stack>
                    ) : (
                      value
                    )}
                  </Typography>
                </Stack>
              }
            />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default ProductSpecification;
