import { Box, Paper, Typography } from '@mui/material';

const howToHtml = `
  <p>Ibanez serial numbers are generally found on the back of the headstock and can often be decoded by prefix plus date digits. A common modern pattern is factory prefix + YYMM + sequence (for example, <strong>I160100231</strong> = Indonesia, January 2016). This decoder also supports <strong>GI + 7 digits</strong> legacy Indonesia GIO format (e.g., GI0012180 = December 2000), <strong>5A/5B/5N + 9 digits</strong> (two-character import prefix with YYMM date digits), <strong>4H/OZ + 9 digits</strong> (China two-character/two-letter prefix variants), <strong>4H + 10 digits</strong> (extended China variant: YY + batch/line + MM + sequence, e.g., 4H2300501778 = May 2023), <strong>H + 9 digits</strong> (China H-prefix variant), China GIO-style <strong>GZ + 9 digits</strong> (e.g., GZ150102324 = January 2015), <strong>SQ + YY + month-letter + sequence</strong> for some Saehan acoustic production (e.g., SQ08E06597 = May 2008), Korean 1990s <strong>C + 7 digits</strong> (e.g., C8016949 = January 1998), <strong>B + 9 digits</strong> (month-letter variant where B = February), China <strong>L/N + 9 digits</strong> variants (e.g., L160200319 and N230401406), <strong>numeric-only 7-10 digits</strong> interpreted as date + sequence on import variants (e.g., 220600378 = June 2022, 02010903 = January 2002, 4120210 = December 2014 using YMM + sequence, 5230401406 = April 2023 with leading factory digit), legacy <strong>YYMM###/#### + 1-2 letters</strong> formats (e.g., 83030041D and 8303004ID = March 1983), and compound codes like <strong>212Y03GS251101952</strong> or <strong>215N015N250401143</strong> where an internal prefix is prepended to a standard date payload.</p>

  <h3>Decoding by Location &amp; Year</h3>
  <ul>
    <li><strong>Japan (FujiGen, 1987-Present):</strong> Starts with a letter, followed by 6-7 digits. The first two digits after the letter are the year (e.g., F97XXXX = 1997).</li>
    <li><strong>Indonesia (2001+):</strong> Usually <strong>I/K/J/U + 9 digits</strong> with <strong>YYMM + sequence</strong> (e.g., U081100181 = November 2008). An extended <strong>+10 digit</strong> variant also appears as <strong>YY + line + MM + sequence</strong> (e.g., I1161207864 = December 2011).</li>
    <li><strong>Indonesia GIO Legacy:</strong> <strong>GI + 7 digits</strong> appears on some early GIO production (e.g., GI0012180 = December 2000).</li>
    <li><strong>Import Prefix Variants:</strong> Some serials use non-standard import prefixes with <strong>+ 9 digits</strong> (for example, <strong>5A</strong>, <strong>5B</strong>, <strong>5N</strong>, <strong>4H</strong>, <strong>OZ</strong>, or <strong>H</strong>); the decoder treats these as factory/line codes and uses the remaining digits as <strong>YYMM + sequence</strong> (e.g., 5A210401373 = April 2021, 5B160100231 = January 2016, 5N230401406 = April 2023, 4H140800605 = August 2014, OZ100500158 = May 2010, H081100181 = November 2008). A 4H extended variant with <strong>+ 10 digits</strong> is also supported as <strong>YY + batch/line + MM + sequence</strong> (e.g., 4H2300501778 = May 2023). Some Saehan acoustic serials use <strong>SQ + YY + month-letter + sequence</strong> (e.g., SQ08E06597 = May 2008).</li>
    <li><strong>Korea 1990s C-prefix 7-digit Variant:</strong> Some Korean Cort serials appear as <strong>C + 7 digits</strong> and are parsed as <strong>YMM + sequence</strong> (for example, <strong>C8016949</strong> = January 1998 at Cort).</li>
    <li><strong>Month-letter Variant:</strong> Some serials appear as <strong>B + 9 digits</strong>; in this case the leading letter is treated as month code (A=Jan, B=Feb, etc.) rather than factory code (e.g., B160100231 = February 2016).</li>
    <li><strong>Numeric-only Import Variant:</strong> Some modern imports use <strong>8-10 digits only</strong> with no leading letters; these are decoded primarily as <strong>YYMM + sequence</strong> (or <strong>factory-digit + YYMM + sequence</strong> on some 10-digit runs) (e.g., 220600378 = June 2022, 02010903 = January 2002, 5230401406 = April 2023). If YYMM yields an invalid month on 8- or 9-digit serials, the decoder falls back to <strong>YMM + sequence</strong> and includes an alternate-year note (e.g., 40800605, 311717707).</li>
    <li><strong>6-digit Numeric Variants:</strong> Some serials are read as <strong>YYMMSS</strong> (e.g., 041195 = November 2004, with possible 1994 vintage alt-read), some fit pre-letter <strong>YMMNNN</strong> (e.g., 402989 = February 1974 with an alternate 1984 read), while others fit late-80s <strong>YY + sequence</strong> (e.g., 881865), often tied to USA-linked assembly or omitted-prefix Japanese runs.</li>
    <li><strong>World Short WK Format:</strong> Some Korean World factory serials appear as <strong>WK + 4 digits</strong> (e.g., WK1007). These can have more than one plausible interpretation, so the decoder returns a primary parse and includes an alternate-read note.</li>
    <li><strong>Korea/China/Other Imports:</strong> Often use a factory letter/prefix followed by year-month style digits, but exact rules vary by plant and era.</li>
    <li><strong>Older Models (Pre-1976):</strong> Often have no serial number.</li>
    <li><strong>Pedals:</strong> The first digit of a 4-digit serial number typically represents the last digit of the year (e.g., "3" = 1983).</li>
  </ul>

  <h3>Key Identification Clues</h3>
  <ul>
    <li><strong>Letter Prefix:</strong> Identifies factory/origin (e.g., F/J = Japan, I = Indonesia, C = China, K = Korea).</li>
    <li><strong>First 2 Digits (Modern):</strong> Represent the year (e.g., 05 = 2005).</li>
    <li><strong>Input Cleanup:</strong> If your serial includes spaces/hyphens (e.g., B-160100231), likely character misreads like <strong>O</strong> vs <strong>0</strong> (e.g., I11o626774, Ao3oooo9), or the known <strong>HU</strong> variant (e.g., HU081100181), the decoder retries normalized variants automatically and updates the serial box when a corrected format succeeds.</li>
    <li><strong>Model vs Serial:</strong> Entries like <strong>SR305EDX</strong> or <strong>GRG170DX</strong> are model names, not serial numbers. They can suggest likely country/factory, but exact dating needs the stamped serial number.</li>
    <li><strong>Online Tools:</strong> Check the Ibanez Wiki for the most comprehensive database.</li>
  </ul>

  <p>If the serial number is missing or the guitar is from the mid-70s, it may be necessary to check potentiometer codes or neck pocket stamps, as Ibanez did not consistently use serial numbers until 1976.</p>
`;

const IbanezHowToPanel = () => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, height: 1 }}>
      <Typography variant="h6" mb={3}>
        How to decode an Ibanez serial #
      </Typography>

      <Box
        sx={{
          color: 'text.secondary',
          '& p': { mt: 0, mb: 2.5, typography: 'body2', lineHeight: 1.65 },
          '& h3': { mt: 4, mb: 2, color: 'text.primary', typography: 'h6' },
          '& ul': { mt: 0, mb: 2.5, pl: 3 },
          '& li': { mb: 1.5, typography: 'body2', lineHeight: 1.7 },
          '& strong': { color: 'text.primary', fontWeight: 600, opacity: 0.9 },
        }}
        dangerouslySetInnerHTML={{ __html: howToHtml }}
      />

      <Box
        component="figure"
        sx={{
          mt: 4,
          mx: 0,
          mb: 0,
        }}
      >
        <Box
          component="img"
          src="/images/serial-number-examples/ibanez-serial-example.jpg"
          alt="Ibanez headstock back with serial number"
          loading="lazy"
          sx={{
            width: 1,
            maxWidth: 720,
            borderRadius: 2,
            display: 'block',
          }}
        />
        <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          Example: headstock serial number.
        </Typography>
      </Box>
    </Paper>
  );
};

export default IbanezHowToPanel;
