import { Button, InputAdornment, SxProps } from '@mui/material';
import StyledTextField from 'components/styled/StyledTextField';
import IconifyIcon from 'components/base/IconifyIcon';

interface SearchBoxButtonProps {
  type?: 'default' | 'slim';
  sx?: SxProps;
}

interface SearchBoxProps {
  sx?: SxProps;
}

const SearchBox = ({ sx }: SearchBoxProps) => {
  return (
    <StyledTextField
      sx={sx}
      fullWidth
      value=""
      placeholder="Search"
      aria-label="Search"
      slotProps={{
        input: {
          readOnly: true,
          startAdornment: (
            <InputAdornment position="start">
              <IconifyIcon icon="material-symbols:search-rounded" fontSize={20} />
            </InputAdornment>
          ),
          sx: {
            borderRadius: 5,
            border: 1,
            borderStyle: 'solid',
            borderColor: 'transparent',
          },
        },
      }}
    />
  );
};

export const SearchBoxButton = ({ type = 'default', sx }: SearchBoxButtonProps) => {
  return (
    <Button
      className="search-box-button"
      color="neutral"
      shape="circle"
      variant="soft"
      size={type === 'slim' ? 'small' : 'medium'}
      sx={sx}
      aria-label="Search"
    >
      <IconifyIcon
        icon="material-symbols:search-rounded"
        sx={[{ fontSize: 20 }, type === 'slim' && { fontSize: 18 }]}
      />
    </Button>
  );
};

export default SearchBox;
