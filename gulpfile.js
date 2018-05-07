const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const del = require('del');
const manifest = require('./dist/manifest.json');

const $ = gulpLoadPlugins();

gulp.task('extras', () =>
  gulp.src([
    'app/*.*',
    'app/scripts/*',
    'app/scripts/libs/chrome-promise.js',
    'app/scripts/libs/isotope.pkgd.min.js',
    'app/scripts/libs/md5.min.js',
    'app/scripts/libs/moment.min.js',
    'app/scripts/src/*',
    'app/_locales/**',
    '!app/*.html',
  ], {
    base: 'app',
    dot: true,
  }).pipe(gulp.dest('dist')));

function lint(files, options) {
  return () =>
    gulp.src(files)
      .pipe($.eslint(options))
      .pipe($.eslint.format());
}

gulp.task('lint', lint([
  'app/scripts/**/*.js',
  '!app/scripts/libs/*.js',
], {
  env: {
    es6: true,
  },
}));

gulp.task('images', () =>
  gulp.src('app/images/**/*')
    .pipe($.if($.if.isFile, $.cache($.imagemin({
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{ cleanupIDs: false }],
    }))
      .on('error', (err) => {
        console.log(err);
        this.end();
      })))
    .pipe(gulp.dest('dist/images')));

gulp.task('html', () =>
  gulp.src('app/*.html')
    .pipe($.useref({ searchPath: ['app'] }))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.cleanCss({ compatibility: '*' })))
    .pipe($.if('*.html', $.htmlmin({
      collapseWhitespace: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
    })))
    .pipe(gulp.dest('dist')));

gulp.task('clean', del.bind(null, ['dist']));

gulp.task('copy-css', () =>
  gulp.src([
    'node_modules/materialize-css/dist/css/materialize.css',
    'node_modules/magnific-popup/dist/magnific-popup.css',
  ])
    .pipe(gulp.dest('app/styles/libs')));

gulp.task('copy-js', () =>
  gulp.src([
    'node_modules/blueimp-md5/js/md5.min.js',
    'node_modules/chrome-promise/chrome-promise.js',
    'node_modules/imagesloaded/imagesloaded.pkgd.js',
    'node_modules/isotope-layout/dist/isotope.pkgd.min.js',
    'node_modules/jquery/dist/jquery.js',
    'node_modules/magnific-popup/dist/jquery.magnific-popup.js',
    'node_modules/materialize-css/dist/js/materialize.js',
    'node_modules/moment/min/moment.min.js',
  ])
    .pipe(gulp.dest('app/scripts/libs')));

gulp.task('copy', gulp.parallel('copy-css', 'copy-js'));

gulp.task('watch', gulp.series('copy', 'lint'), () => {
  $.livereload.listen();

  gulp.watch([
    'app/*.html',
    'app/scripts/**/*.js',
    'app/images/**/*',
    'app/styles/**/*',
    'app/_locales/**/*.json',
    '!app/scripts/libs/*.js',
    '!app/styles/libs/*.js',
  ]).on('change', $.livereload.reload);

  gulp.watch(['app/scripts/**/*.js', '!app/scripts/libs/*.js'], ['lint']);
});

gulp.task('size', () =>
  gulp.src('dist/**/*').pipe($.size({ title: 'build', gzip: true })));

gulp.task('package', () =>
  gulp.src('dist/**')
    .pipe($.zip(`oh-my-ig-${manifest.version}.zip`))
    .pipe(gulp.dest('package')));

gulp.task('build', gulp.series(
  'copy', 'lint',
  gulp.parallel('html', 'images', 'extras'),
  'size',
));

gulp.task('default', gulp.series('clean'), (cb) => {
  gulp.series('build', cb);
});
