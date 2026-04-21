import { PaletteOptions } from '@mui/material/styles';
import { cssVarRgba, generatePaletteChannel } from 'lib/utils';
import {
  basic,
  blue,
  grey as colorGrey,
  green,
  lightBlue,
  orange,
  purple,
  red,
} from '../colors/base';

export const darkPaletteMainColors = {
  primary: '#cdb992',
  secondary: purple[400],
  error: red[400],
  warning: orange[400],
  success: green[400],
  info: lightBlue[400],
  neutral: '#a79a83',
  paper: '#201d16',
  textPrimary: '#e7dcc5',
} as const;

const common = generatePaletteChannel({ white: basic.white, black: basic.black });
const grey = generatePaletteChannel(colorGrey);
const coalCreek = {
  bgDark: '#0d0d0a',
  bgAlt: '#201d16',
  textCream: '#e7dcc5',
  textLight: '#f1ead9',
  textMuted: '#a79a83',
  gold: '#9f9172',
  goldLight: '#cdb992',
  goldDark: '#6a614d',
  border: 'rgba(159, 145, 114, 0.25)',
  borderLight: 'rgba(159, 145, 114, 0.45)',
};

const darkNeutral = generatePaletteChannel({
  lighter: '#14120d',
  light: coalCreek.bgAlt,
  main: coalCreek.textMuted,
  dark: coalCreek.textCream,
  darker: coalCreek.textLight,
  contrastText: coalCreek.bgDark,
});
const darkPrimary = generatePaletteChannel({
  lighter: '#17140f',
  light: coalCreek.goldDark,
  main: coalCreek.gold,
  dark: coalCreek.goldLight,
  darker: coalCreek.textLight,
  contrastText: coalCreek.bgDark,
});
const darkSecondary = generatePaletteChannel({
  lighter: purple[950],
  light: purple[700],
  main: purple[400],
  dark: purple[300],
  darker: purple[100],
  contrastText: purple[950],
});
const darkError = generatePaletteChannel({
  lighter: red[950],
  light: red[600],
  main: red[400],
  dark: red[300],
  darker: red[200],
  contrastText: red[950],
});
const darkWarning = generatePaletteChannel({
  lighter: orange[950],
  light: orange[800],
  main: orange[400],
  dark: orange[300],
  darker: orange[200],
  contrastText: orange[950],
});
const darkSuccess = generatePaletteChannel({
  lighter: green[950],
  light: green[700],
  main: green[400],
  dark: green[300],
  darker: green[200],
  contrastText: green[950],
});
const darkInfo = generatePaletteChannel({
  lighter: lightBlue[950],
  light: lightBlue[700],
  main: lightBlue[400],
  dark: lightBlue[300],
  darker: lightBlue[200],
  contrastText: lightBlue[950],
});

const darkAction = generatePaletteChannel({
  active: coalCreek.goldLight,
  hover: 'rgba(159, 145, 114, 0.14)',
  selected: 'rgba(159, 145, 114, 0.2)',
  disabled: 'rgba(167, 154, 131, 0.45)',
  disabledBackground: 'rgba(159, 145, 114, 0.12)',
  focus: 'rgba(159, 145, 114, 0.24)',
});

const darkDivider = coalCreek.border;
const darkMenuDivider = coalCreek.border;
const darkDividerLight = coalCreek.borderLight;
const darkText = generatePaletteChannel({
  primary: coalCreek.textCream,
  secondary: coalCreek.textMuted,
  disabled: 'rgba(167, 154, 131, 0.5)',
});
const darkBackground = generatePaletteChannel({
  default: coalCreek.bgDark,
  paper: coalCreek.bgAlt,
  elevation1: '#17140f',
  elevation2: coalCreek.bgAlt,
  elevation3: '#2b261c',
  elevation4: '#383120',
  menu: coalCreek.bgAlt,
  menuElevation1: '#2b261c',
  menuElevation2: '#383120',
});

const darkVibrant = {
  listItemHover: cssVarRgba(common.whiteChannel, 0.1),
  buttonHover: cssVarRgba(common.whiteChannel, 0.1),
  textFieldHover: cssVarRgba(common.whiteChannel, 0.1),
  text: {
    secondary: cssVarRgba(common.whiteChannel, 0.7),
    disabled: cssVarRgba(common.whiteChannel, 0.5),
  },
  overlay: cssVarRgba(common.whiteChannel, 0),
};

const darkChGrey = generatePaletteChannel({
  50: grey[900],
  100: grey[800],
  200: grey[700],
  300: grey[600],
  400: grey[500],
  500: grey[400],
  600: grey[300],
  700: grey[200],
  800: grey[100],
  900: grey[50],
  950: common.white,
});
const darkChRed = generatePaletteChannel({
  50: red[950],
  100: red[800],
  200: red[700],
  300: red[600],
  400: red[500],
  500: red[400],
  600: red[300],
  700: red[200],
  800: red[100],
  900: red[50],
  950: common.white,
});
const darkChBlue = generatePaletteChannel({
  50: blue[950],
  100: blue[800],
  200: blue[700],
  300: blue[600],
  400: blue[500],
  500: blue[400],
  600: blue[300],
  700: blue[200],
  800: blue[100],
  900: blue[50],
  950: common.white,
});
const darkChGreen = generatePaletteChannel({
  50: green[950],
  100: green[800],
  200: green[700],
  300: green[600],
  400: green[500],
  500: green[400],
  600: green[300],
  700: green[200],
  800: green[100],
  900: green[50],
  950: common.white,
});
const darkChOrange = generatePaletteChannel({
  50: orange[950],
  100: orange[800],
  200: orange[700],
  300: orange[600],
  400: orange[500],
  500: orange[400],
  600: orange[300],
  700: orange[200],
  800: orange[100],
  900: orange[50],
  950: common.white,
});
const darkChLightBlue = generatePaletteChannel({
  50: lightBlue[950],
  100: lightBlue[800],
  200: lightBlue[700],
  300: lightBlue[600],
  400: lightBlue[500],
  500: lightBlue[400],
  600: lightBlue[300],
  700: lightBlue[200],
  800: lightBlue[100],
  900: lightBlue[50],
  950: common.white,
});
const darkChPurple = generatePaletteChannel({
  50: purple[950],
  100: purple[800],
  200: purple[700],
  300: purple[600],
  400: purple[500],
  500: purple[400],
  600: purple[300],
  700: purple[200],
  800: purple[100],
  900: purple[50],
  950: common.white,
});

export const darkPalette = {
  common,
  grey,
  primary: darkPrimary,
  secondary: darkSecondary,
  error: darkError,
  warning: darkWarning,
  success: darkSuccess,
  info: darkInfo,
  neutral: darkNeutral,
  action: darkAction,
  divider: darkDivider,
  dividerLight: darkDividerLight,
  menuDivider: darkMenuDivider,
  text: darkText,
  background: darkBackground,
  vibrant: darkVibrant,
  chGrey: darkChGrey,
  chRed: darkChRed,
  chBlue: darkChBlue,
  chGreen: darkChGreen,
  chOrange: darkChOrange,
  chLightBlue: darkChLightBlue,
  chPurple: darkChPurple,
} as PaletteOptions;
