import { Link, SvgIconProps, Typography } from '@mui/material';
import { rootPaths } from 'routes/paths';

interface LogoProps extends SvgIconProps {
  showName?: boolean;
  // When set, the logo acts as a button (e.g. opening the site menu) instead of a home link.
  onClick?: () => void;
}

const Logo = ({ sx, showName = true, onClick }: LogoProps) => {
  return (
    <Link
      {...(onClick
        ? { component: 'button', type: 'button', onClick, 'aria-label': 'Open site menu' }
        : { href: rootPaths.root })}
      underline="none"
      sx={{
        border: 0,
        p: 0,
        bgcolor: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <img
        src="https://www.coalcreekguitars.com/images/coal-creek-logo-480.webp"
        alt="Coal Creek Guitars"
        style={{
          width: 32,
          height: 32,
          objectFit: 'contain',
          display: 'block',
        }}
      />
      {showName && (
        <Typography
          sx={{
            color: 'text.primary',
            fontWeight: 700,
            fontSize: 20,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            ...sx,
          }}
        >
          Coal Creek Guitars
        </Typography>
      )}
    </Link>
  );
};

export default Logo;
