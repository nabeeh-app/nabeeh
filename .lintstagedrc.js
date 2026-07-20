module.exports = {
  'backend/**/*.js': (filenames) => {
    const relative = filenames.map((f) => f.replace(/^backend\//, ''));
    return [
      `npm run lint --prefix backend -- --no-warn-ignored`,
      `npm test --prefix backend -- --bail --findRelatedTests ${relative.join(' ')} --passWithNoTests`,
    ];
  },
  'frontend/**/*.{ts,tsx}': `npm run lint --prefix frontend`,
};
