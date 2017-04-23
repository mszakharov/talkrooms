var del       = require('del');
var run       = require('run-sequence');
var gulp      = require('gulp');
var postcss   = require('gulp-postcss');
var replace   = require('gulp-replace');
var cssnext   = require('postcss-cssnext');

var timestamp = Math.round(Date.now() / 1000).toString(36);

gulp.task('clean', function() {
    return del('production/*');
});


// Add cache busting timestamp to js/css references
gulp.task('html', function() {

    var ref = /(src|href)="(.*?\.(?:js|css))"/g;

    function addTimestamp(match, attr, url) {
        if (/jquery|fastclick/.test(url)) {
            return match; // Exclude external scripts
        } else {
            return `${attr}="${url}?${timestamp}"`;
        }
    }

    return gulp
        .src('development/index.html')
        .pipe(replace(ref, addTimestamp))
        .pipe(gulp.dest('production/'));

});


gulp.task('index', function() {
    return gulp
        .src([
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

// Copy css and add prefixes
gulp.task('styles', function() {

    var processors = [
        cssnext({
            browsers: 'last 5 versions', // for autoprefixer and features list
            autoprefixer: {
                remove: false
            }
        })
    ];

    return gulp
        .src('development/style/*.css')
        .pipe(postcss(processors))
        .pipe(gulp.dest('production/style/'));

});

// Copy all files except css
gulp.task('images', function() {
    return gulp
        .src([
            'development/style/**/*',
            '!development/style/*.css'
        ])
        .pipe(gulp.dest('production/style/'));
});


gulp.task('default', function() {
    run('clean', ['html', 'index', 'scripts', 'styles', 'images']);
});
