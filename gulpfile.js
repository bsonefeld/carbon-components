'use strict';

// Node
const path = require('path');

// Styles
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');

// Javascript deps
const babel = require('gulp-babel');
const eslint = require('gulp-eslint');
const uglify = require('gulp-uglify');
const pump = require('pump');

// BrowserSync
const browserSync = require('browser-sync').create();

// Gulp
const gulp = require('gulp');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');
const gutil = require('gulp-util');
const jsdoc = require('gulp-jsdoc3');

// Generic utility
const del = require('del');
const exec = require('child_process').exec;

// Test environment
const Server = require('karma').Server;
const cloptions = require('minimist')(process.argv.slice(2), {
  alias: {
    k: 'keepalive',
  },
  boolean: ['keepalive'],
});

/**
 * BrowserSync
 */

gulp.task('browser-sync', ['build:dev'], () => {
  browserSync.init({
    logPrefix: 'Carbon Components',
    open: false,
    proxy: 'localhost:8080',
    timestamps: false,
  });
});

/**
 * Clean
 */

// Use: npm run prebuild
gulp.task('clean', () =>
  del([
    'scss',
    'css',
    'es',
    'umd',
    'scripts',
    'html',
    'dist',
    'demo/**/*.{js,map}',
    '!demo/js/demo-switcher.js',
    '!demo/js/theme-switcher.js',
    '!demo/index.js',
    '!demo/polyfills/*.js',
  ])
);

/**
 * JavaScript Tasks
 */

gulp.task('scripts:dev', cb => {
  exec('./node_modules/.bin/rollup -c tools/rollup.config.dev.js', err => {
    browserSync.reload();
    cb(err);
  });
});

gulp.task('scripts:umd', () => {
  const srcFiles = ['./src/**/*.js'];
  const babelOpts = {
    presets: [
      [
        'env',
        {
          targets: {
            browsers: ['last 1 version', 'ie >= 11'],
          },
        },
      ],
    ],
    plugins: ['transform-es2015-modules-umd', 'transform-class-properties'],
  };

  return gulp.src(srcFiles).pipe(babel(babelOpts)).pipe(gulp.dest('umd/'));
});

gulp.task('scripts:es', () => {
  const srcFiles = ['./src/**/*.js'];
  const babelOpts = {
    presets: [
      [
        'env',
        {
          modules: false,
          targets: {
            browsers: ['last 1 version', 'ie >= 11'],
          },
        },
      ],
    ],
    plugins: ['transform-class-properties'],
  };

  return gulp.src(srcFiles).pipe(babel(babelOpts)).pipe(gulp.dest('es/'));
});

gulp.task('scripts:rollup', cb => {
  exec('./node_modules/.bin/rollup -c tools/rollup.config.js', err => {
    cb(err);
  });
});

gulp.task('scripts:compiled', ['scripts:rollup'], cb => {
  const srcFile = './scripts/carbon-components.js';

  pump(
    [
      gulp.src(srcFile),
      uglify(),
      rename('carbon-components.min.js'),
      gulp.dest('scripts'),
    ],
    cb
  );
});

/**
 * Sass Tasks
 */

gulp.task('sass:compiled', () => {
  function buildStyles(prod) {
    return gulp
      .src('src/globals/scss/styles.scss')
      .pipe(sourcemaps.init())
      .pipe(
        sass({
          outputStyle: prod ? 'compressed' : 'expanded',
        }).on('error', sass.logError)
      )
      .pipe(
        autoprefixer({
          browsers: ['> 1%', 'last 2 versions'],
        })
      )
      .pipe(
        rename(filePath => {
          if (filePath.basename === 'styles') {
            filePath.basename = 'carbon-components';
          }
          if (prod) {
            filePath.extname = `.min${filePath.extname}`;
          }
        })
      )
      .pipe(
        sourcemaps.write('.', {
          includeContent: false,
          sourceRoot: '../src',
        })
      )
      .pipe(gulp.dest('css'))
      .pipe(browserSync.stream());
  }

  buildStyles(); // Expanded CSS
  buildStyles(true); // Minified CSS
});

gulp.task('sass:dev', () =>
  gulp
    .src('demo/scss/demo.scss')
    .pipe(sourcemaps.init())
    .pipe(
      sass({
        outputStyle: 'expanded',
      }).on('error', sass.logError)
    )
    .pipe(
      autoprefixer({
        browsers: ['> 1%', 'last 2 versions'],
      })
    )
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('demo'))
    .pipe(browserSync.stream())
);

gulp.task('sass:source', () => {
  const srcFiles = './src/**/*.scss';

  return gulp.src(srcFiles).pipe(gulp.dest('scss'));
});

gulp.task('html:source', () => {
  const srcFiles = './src/components/**/*.html';

  return gulp.src(srcFiles).pipe(gulp.dest('html'));
});

/**
 * Lint
 */

gulp.task('lint', () =>
  gulp
    .src([
      'gulpfile.js',
      'server.js',
      'src/**/*.js',
      'tests/**/*.js',
      'demo/**/*.js',
    ])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
    .pipe(
      eslint.results(results => {
        const count = results.warningCount;
        if (count > 0) {
          throw new gutil.PluginError('gulp-eslint', {
            name: 'ESLintWarning',
            message: `Has ${count} warning${count > 1 ? 's' : ''}`,
          });
        }
      })
    )
);

/**
 * JSDoc
 */

gulp.task('jsdoc', cb => {
  gulp
    .src('./src/**/*.js')
    .pipe(
      babel({
        plugins: ['transform-class-properties'],
        babelrc: false,
      })
    )
    .pipe(gulp.dest('./docs/js/tmp'))
    .on('end', () => {
      gulp.src(['README.md', 'docs/js/tmp/**/*.js'], { read: false }).pipe(
        jsdoc(
          Object.assign(require('gulp-jsdoc3/dist/jsdocConfig.json'), {
            // eslint-disable-line global-require
            opts: {
              destination: './docs/js',
            },
          }),
          err => {
            if (err) {
              cb(err);
            } else {
              del('./docs/js/tmp', cb);
            }
          }
        )
      );
    })
    .on('error', cb);
});

/**
 * Test
 */

gulp.task('test', ['test:unit', 'test:a11y']);

gulp.task('test:unit', done => {
  new Server(
    {
      configFile: path.resolve(__dirname, 'tests/karma.conf.js'),
      singleRun: !cloptions.keepalive,
    },
    done
  ).start();
});

gulp.task('test:a11y', ['sass:compiled'], done => {
  new Server(
    {
      configFile: path.resolve(__dirname, 'tests/karma-ibma.conf.js'),
      singleRun: !cloptions.keepalive,
    },
    done
  ).start();
});

// Watch Tasks
gulp.task('watch', () => {
  gulp.watch('src/**/**/*.html').on('change', browserSync.reload);
  gulp.watch(['src/**/**/*.js'], ['scripts:dev', 'scripts:compiled']);
  gulp.watch(['src/**/**/*.scss', 'demo/**/*.scss'], ['sass:dev']);
});

gulp.task('serve', ['browser-sync', 'watch']);

// Build task collection
gulp.task('build:scripts', ['scripts:umd', 'scripts:es', 'scripts:compiled']);
gulp.task('build:styles', ['sass:compiled', 'sass:source']);

// Mapped to npm run build
gulp.task('build', ['build:scripts', 'build:styles', 'html:source']);

// For demo environment
gulp.task('build:dev', ['sass:dev', 'scripts:dev']);

gulp.task('default', () => {
  // eslint-disable-next-line no-console
  console.log(
    '\n\n Please use `$ npm run dev` and navigate to \n http://localhost:3000 to view project locally \n\n'
  );
});
