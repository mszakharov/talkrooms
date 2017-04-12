var del       = require('del');
var run       = require('run-sequence');
var gulp      = require('gulp');
var postcss   = require('gulp-postcss');
var cssnext   = require('postcss-cssnext');

gulp.task('clean', function() {
    return del('production/*');
});


gulp.task('index', function() {
    return gulp
        .src([
            'development/index.html',
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
    run('clean', ['index', 'scripts', 'styles', 'images']);
});
