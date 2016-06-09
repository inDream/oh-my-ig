'use strict';

var gulp = require('gulp');
var gulpLoadPlugins = require('gulp-load-plugins');
var del = require('del');
var runSequence = require('run-sequence');
var wiredep = require('wiredep').stream;

const $ = gulpLoadPlugins();

gulp.task('extras', () => {
  return gulp.src([
    'app/*.*',
    'app/scripts/**/*',
    'app/_locales/**',
    '!app/*.html',
  ], {
    base: 'app',
    dot: true
  }).pipe(gulp.dest('dist'));
});

function lint(files, options) {
  return () => {
    return gulp.src(files)
      .pipe($.eslint(options))
      .pipe($.eslint.format());
  };
}

gulp.task('lint', lint([
    'app/scripts/**/*.js',
    '!app/scripts/libs/*.js'
  ], {
  env: {
    es6: true
  }
}));

gulp.task('images', () => {
  return gulp.src('app/images/**/*')
    .pipe($.if($.if.isFile, $.cache($.imagemin({
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{cleanupIDs: false}]
    }))
    .on('error', function (err) {
      console.log(err);
      this.end();
    })))
    .pipe(gulp.dest('dist/images'));
});

gulp.task('html',  () => {
  return gulp.src('app/*.html')
    .pipe($.useref({searchPath: ['.tmp', 'app', '.']}))
    // .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.cleanCss({compatibility: '*'})))
    .pipe($.if('*.html', $.htmlmin({removeComments: true, collapseWhitespace: true})))
    .pipe(gulp.dest('dist'));
});

gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

gulp.task('watch', ['copy', 'lint', 'html'], () => {
  $.livereload.listen();

  gulp.watch([
    'app/*.html',
    'app/scripts/**/*.js',
    'app/images/**/*',
    'app/styles/**/*',
    'app/_locales/**/*.json',
    '!app/scripts/libs/*.js',
  ]).on('change', $.livereload.reload);

  gulp.watch(['app/scripts/**/*.js', '!app/scripts/libs/*.js'], ['lint']);
  gulp.watch('bower.json', ['wiredep']);
});

gulp.task('size', () => {
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('wiredep', () => {
  gulp.src('app/*.html')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe(gulp.dest('app'));
});

gulp.task('package', function () {
  var manifest = require('./dist/manifest.json');
  return gulp.src('dist/**')
      .pipe($.zip('oh-my-ig-' + manifest.version + '.zip'))
      .pipe(gulp.dest('package'));
});

gulp.task('build', (cb) => {
  runSequence(
    'copy', 'lint',
    ['html', 'images', 'extras'],
    'size', cb);
});

gulp.task('copy', () => {
  return gulp.src([
    'node_modules/chrome-promise/chrome-promise.js',
    'node_modules/moment/min/moment.min.js',
    'node_modules/isotope-layout/dist/isotope.pkgd.min.js',
    'node_modules/whatwg-fetch/fetch.js'
    ])
  .pipe(gulp.dest('app/scripts/libs'))
  .pipe(gulp.dest('dist/scripts/libs'));
});

gulp.task('default', ['clean'], cb => {
  runSequence('build', cb);
});
