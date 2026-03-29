import { Link, SvgIconProps, Typography } from '@mui/material';
import { rootPaths } from 'routes/paths';

interface LogoProps extends SvgIconProps {
  showName?: boolean;
  href?: string;
}

const Logo = ({ sx, showName = true, href = rootPaths.root }: LogoProps) => {
  return (
    <Link
      href={href}
      underline="none"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
      }}
    >
      <img
        src="/images/coal-creek-logo.png"
        alt="Coal Creek Products"
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
            fontSize: 24,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            ...sx,
          }}
        >
          Coal Creek Products
        </Typography>
      )}
    </Link>
  );
};

export default Logo;
