module.exports = {
  pipeline: {
    build: ['^build'],
    test: ['build'],
    bundle: ['build'],
    lint: [],
    watch: []
  },
  npmClient: 'yarn'
};
