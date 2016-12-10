'use strict';

process.on('uncaughtException', function (err) {
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack)
    process.exit(1)
})

const
    path = require('path'),
    gulp = require('gulp'),
    sourcemaps = require('gulp-sourcemaps'),
    fork = require('child_process').fork,
    spawn = require('child_process').spawn,
    runSequence = require('run-sequence'),
    ts = require('gulp-typescript'),
    debug = require('debug')('TradeJS:Gulp'),
    es = require("event-stream"),
    argv = require('minimist')(process.argv.slice(2)),
    webpack = require('webpack-stream');

const PATH_APP_INIT_FILE = 'dist/server/app';

let node = null;

gulp.task('server:dev', function(callback) {
    runSequence('server:build:run', ['server:watch'], callback);
});

/***************************************************************
 *
 * SERVER SERVER SERVER SERVER SERVER SERVER SERVER
 *
 **************************************************************/
gulp.task('server:dev', function(callback) {
    runSequence('server:build:run', ['server:watch'], callback);
});

gulp.task('server:kill', killProcess);

gulp.task('server:run', function(callback) {

    node = fork(PATH_APP_INIT_FILE, [...process.argv], {
        detached: true,
        env: process.env,
        stdio: ['pipe', process.stdout, process.stderr, 'ipc']
    });

    callback();
});

gulp.task('server:build', function() {

    let pipes = ['server', 'shared'].map(dir => {

        let tsProject = ts.createProject(`./src/${dir}/tsconfig.json`),
            tsResult = tsProject.src()
                .pipe(sourcemaps.init())
                .pipe(tsProject());

        return tsResult.js
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest(`./dist/${dir}`))
    });

    return es.merge(pipes);
});

gulp.task('server:build:run', function() {
    runSequence('server:kill', ['copy-shared-assets', 'server:build'], 'server:run');
});

gulp.task('server:watch', [], function() {
    gulp.watch(['./src/server/**/*.ts', './src/shared/**/*.ts', '!./src/shared/_builds/**/*'], ['server:build:run']);
});

/** TEMP NEEDED TO COPY OVER JSON FILES TO DIST FOLDER **/
gulp.task('copy-shared-assets', function() {
    gulp.src(['./src/shared/**/*.json', '!**/tsconfig.json'])
        .pipe(gulp.dest('./dist/shared'));
});

/***************************************************************
*
* CLIENT CLIENT CLIENT CLIENT CLIENT CLIENT CLIENT
*
**************************************************************/

gulp.task('client:prod', function(callback) {
    runSequence('client:build:prod', callback);
});

gulp.task('client:build:prod', function(callback) {
    const
        outputPath = path.join(__dirname, 'dist', 'client'),
        buildNode = spawn('./node_modules/.bin/ng', ['build', '--prod', `--output-path=${outputPath}`], {
            stdio: ['pipe', process.stdout, process.stderr, 'ipc'],
            cwd: './src/client'
        });

    buildNode.on('exit', () => {
        callback();
    })
});

gulp.task('copy-client-assets', function() {
    gulp.src(['./src/client/**/*.html', '!**/index.html'])
        .pipe(gulp.dest('./dist/client'));
});

/***************************************************************
 *
 * CUSTOM CUSTOM CUSTOM CUSTOM CUSTOM
 *
 **************************************************************/
gulp.task('custom:build', function(callback) {
    runSequence('custom:compile', 'custom:copy-assets', callback);
});

gulp.task('custom:watch', function(callback) {

    const watcher = gulp.watch('custom/**/*');
    watcher.on('change', function(event) {

        let inputPath = _getCustomAbsoluteRootFolder(event.path),
            outputPath = _getBuildAbsoluteRootFolder(event.path);

        customBuild(inputPath, outputPath)
            .on('end', () => {

                // Copy assets
                gulp.src([inputPath + '/**/*', '!**/.ts'])
                    .pipe(gulp.dest(outputPath))
                    .on('end', () => {
                        console.info('GULP: Custom build complete');
                    });

            });
    });

    callback();
});

function customBuild(inputPath, outputPath) {

    return gulp.src(inputPath)
        .pipe(webpack({
            entry: path.join(inputPath, 'index'),
            resolve: {
                // Add `.ts` and `.tsx` as a resolvable extension.
                extensions: ['.ts', '.js']
            },
            module: {
                loaders: [
                    // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
                    { test: /\.tsx?$/, loader: 'ts-loader' }
                ]
            },
            alias: {

            }
        }))
        .pipe(gulp.dest(outputPath));
}


gulp.task('custom:compile', function() {

    if (!argv['input-path'] || !argv['output-path'])
        throw new Error('Gulp build custom, --input-path and --output-path must be defined');

    console.log('argv argv', argv);
    let pipes = [argv['input-path']].map(dir => {

        return gulp.src(argv['input-path'])
            .pipe(webpack({
                entry: dir,
                resolve: {
                    // Add `.ts` and `.tsx` as a resolvable extension.
                    extensions: ['.ts', '.js']
                },
                module: {
                    loaders: [
                        // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
                        { test: /\.tsx?$/, loader: 'ts-loader' }
                    ]
                },
                alias: {

                }
            }))
            .pipe(gulp.dest(argv['output-path']));

        // return gulp.src(`${dir}/**/*.*`)
        //     .pipe(ts({
        //         allowJs: true,
        //         noImplicitAny: true,
        //         target: 'es6',
        //         module: "commonjs"
        //     }))
        //     .pipe(gulp.dest(argv['output-path']));
    });

    return es.merge(pipes);
});

gulp.task('custom:copy-assets', function(callback) {
    gulp.src([argv['input-path'] + '/**/*', '!**/.ts'])
        .pipe(gulp.dest(argv['input-path']))
        .on('end', callback);
});

/***************************************************************
 *
 * FORK FORK FORK FORK FORK FORK FORK
 *
 **************************************************************/
function killProcess(callback) {
    if (node && node.pid) {
        node.on('close', () => {
            debug("Child closed");
            typeof callback == 'function' && callback && callback();
        });

        process.kill(-node.pid, 'SIGTERM');

        node = null;
    } else {
        typeof callback == 'function' && callback();
    }
}

process.on('exit', killProcess);
process.on('SIGINT', () => {
    killProcess();
    process.exit();
});
//process.on('SIGHUP', killProcess);

/***************************************************************
 *
 * UTIL UTIL UTIL UTIL UTIL UTIL UTIL
 *
 **************************************************************/

// TODO: Bit of a hacky way to get root folder
function _getFileRelativeRootFolder(filePath) {
    console.log('filePath.split().splice(1, 3).join();', filePath.replace(__dirname, '').split('/').splice(1, 3).join('/'));
    return filePath.replace(__dirname, '').split('/').splice(1, 3).join('/');
}

function _getCustomAbsoluteRootFolder(filePath) {
    return path.join(__dirname, _getFileRelativeRootFolder(filePath));
}

function _getBuildAbsoluteRootFolder(filePath) {
    return path.join(__dirname, '_builds', _getFileRelativeRootFolder(filePath));
}