import { Typography } from '@mui/material';
import { kebabCase } from 'lib/utils';

interface ProductDescriptionsProps {
  descriptions?: { title: string; description: string }[];
  description?: string;
}

const ProductDescription = ({ descriptions = [], description }: ProductDescriptionsProps) => {
  const text = description?.trim();

  return (
    <div>
      <Typography
        variant="h6"
        sx={{
          mb: 3,
        }}
      >
        Description
      </Typography>
      {text ? (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'pre-line',
          }}
        >
          {text}
        </Typography>
      ) : null}
      {descriptions.map(({ title, description }) => (
        <div
          key={kebabCase(title)}
          style={{ marginBottom: 16 }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              color: 'text.secondary',
              lineHeight: 1.5,
              fontWeight: 700,
              mb: 1,
            }}
          >
            {title} :
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {description}
          </Typography>
        </div>
      ))}
    </div>
  );
};

export default ProductDescription;
