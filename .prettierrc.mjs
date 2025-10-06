export default {
  printWidth: 120,
  singleQuote: true,
  trailingComma: 'none',
  endOfLine: 'auto',
  overrides: [
    {
      files: '*.md',
      options: {
        proseWrap: 'always'
      }
    },
    {
      files: 'package.json',
      options: {
        plugins: ['prettier-plugin-packagejson']
      }
    }
  ],
  plugins: ['prettier-plugin-organize-imports']
};
