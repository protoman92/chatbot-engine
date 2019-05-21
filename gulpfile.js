const gulp = require('gulp');
const run = require('gulp-run');

async function build() {
  return new Promise(resolve => {
    return run('npm run build').exec(undefined, () => resolve());
  });
}

function watch() {
  gulp.watch(['./src/**/*', 'rollup*'], build);
}

exports.default = gulp.series(build, watch);
