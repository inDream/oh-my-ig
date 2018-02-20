const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const del = require('del');
const runSequence = require('run-sequence');
const manifest = require('./dist/manifest.json');

const $ = gulpLoadPlugins();

gulp.task('extras', () =>
  gulp.src([
    'app/*.*',
    'app/scripts/**/*',
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

gulp.task('copy', () =>
  gulp.src([
    'node_modules/chrome-promise/chrome-promise.js',
    'node_modules/moment/min/moment.min.js',
    'node_modules/isotope-layout/dist/isotope.pkgd.min.js',
  ])
    .pipe(gulp.dest('app/scripts/libs'))
    .pipe(gulp.dest('dist/scripts/libs')));

gulp.task('watch', ['copy', 'lint'], () => {
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

gulp.task('build', (cb) => {
  runSequence(
    'copy', 'lint',
    ['html', 'images', 'extras'],
    'size',
    cb,
  );
});

gulp.task('default', ['clean'], (cb) => {
  runSequence('build', cb);
});
