const path = require('path');
const { task, src, dest } = require('gulp');

task('build:icons', copyIcons);

function copyIcons() {
    // Copy icons from resources to both nodes and credentials destinations
    const iconSource = path.resolve('resources', '**', '*.{png,svg}');
    const nodesDestination = path.resolve('dist', 'nodes');

    return src(iconSource)
        .pipe(dest(nodesDestination));
}
