var del       = require('del');
var run       = require('run-sequence');
var gulp      = require('gulp');
var postcss   = require('gulp-postcss');
var replace   = require('gulp-replace');
var cssnext   = require('postcss-cssnext');
var imports   = require('postcss-import');

var timestamp = Math.round(Date.now() / 1000).toString(36);

gulp.task('clean', function() {
    return del('production/*');
});


// Copy vendors folder
gulp.task('vendors', function() {
    return gulp
        .src('development/vendors/**/*')
        .pipe(gulp.dest('production/vendors/'));
});


// Copy index.html, add cache busting timestamp to js/css references
gulp.task('html', function() {

    var jsRef  = /src="(\/script\/.*?\.js)"/g;
        cssRef = /href="(\/style\/.*?\.css)"/g;

    return gulp
        .src('development/index.html')
        .pipe(replace(jsRef, `src="$1?${timestamp}"`))
        .pipe(replace(cssRef, `href="$1?${timestamp}"`))
        .pipe(gulp.dest('production/'));

});


gulp.task('index', function() {
    return gulp
        .src([
            'development/privacy.html',
            'development/terms.html',
            'development/robots.txt',
            'development/*.png'
        ])
        .pipe(gulp.dest('production/'));
});


gulp.task('scripts', function() {
    return gulp
        .src('development/script/**/*')
        .pipe(gulp.dest('production/script/'));
});

// Copy css, inline @import rules, add prefixes
gulp.task('styles', function() {

    var processors = [
        imports(),
        cssnext({
            browsers: 'last 5 versions', // for autoprefixer and features list
            autoprefixer: {
                remove: false
            }
        })
    ];

    return gulp
        .src('development/style/**/[^_]*.css')
        .pipe(postcss(processors))
        .pipe(gulp.dest('production/style/'));

});

// Copy all files except css
gulp.task('images', function() {
    return gulp
        .src([
            'development/style/**/*',
            '!development/style/**/*.css'
        ])
        .pipe(gulp.dest('production/style/'));
});


gulp.task('default', function() {
    run('clean', ['html', 'index', 'vendors', 'scripts', 'styles', 'images']);
});
