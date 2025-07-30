const path = require('path');
const { task, src, dest, rename } = require('gulp');
const renamePlugin = require('gulp-rename');

task('build:icons', copyIcons);

function copyIcons() {
    // Copy icons from resources to dist/nodes and flatten
    const iconSource = path.resolve('resources', '**', '*.{png,svg}');
    const nodesDestination = path.resolve('dist', 'nodes');

    return src(iconSource)
        .pipe(renamePlugin(function (filePath) {
            // Flatten: only use the basename (vocant.svg)
            filePath.dirname = '';
        }))
        .pipe(dest(nodesDestination));
}
