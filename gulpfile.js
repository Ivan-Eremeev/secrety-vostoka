        //  *** Команды галпа ***
// Сборка html               = "gulp html"
// Сборка стилей             = "gulp style"
// Сборка js                 = "gulp js"
// Сжатие изображений        = "gulp image"
// Переброска шрифтов в dist = "gulp fonts"
// Сжатие css                = "gulp minify:css"
// Сжатие js                 = "gulp minify:js"
// Сжатие css и js           = "gulp minify"
// Слежение за изменениями   = "gulp watch"
// Создание спрайтов         = "gulp sprite"
// Запустить всю сборку      = "gulp"

// Переменные
const gulp               = require('gulp');
const autoprefixer       = require('gulp-autoprefixer');
const browserSync        = require('browser-sync');
const reload             = browserSync.reload;
const less               = require('gulp-less');
const sass               = require('gulp-sass');
const stylus             = require('gulp-stylus');
const uglify             = require('gulp-uglify');
const sourcemaps         = require('gulp-sourcemaps');
const rigger             = require('gulp-rigger'); // Импорт файлов в html или js или ещё куда (//= footer.html)
const cleancss           = require('gulp-clean-css');
const imagemin           = require('gulp-imagemin');
const pngquant           = require('imagemin-pngquant');
const watch              = require('gulp-watch');
const del                = require('delete');
const rename             = require("gulp-rename");
const gcmq               = require('gulp-group-css-media-queries');
const spritesmith        = require('gulp.spritesmith');

        // *** Используемый препроцессор ***
const preprocessor = {
    base: sass, // less, sass, stylus
    extension: '.scss', // Стиль препроцессора '.less', '.sass', '.scss', '.styl'
};

        // *** Пути ***
const path = {
    src: { // Исходники
        html: './src/*.html',
        js: './src/js/*.js',
        styles: './src/styles/',
        img: './src/img/',
        sprite: './src/img/sprite/*.*',
        fonts: './src/fonts/**/*.*'
    },
	dist: { // Продакшен
        html: './dist/',
        js: './dist/js/',
        css: './dist/css/',
        img: './dist/img/',
        fonts: './dist/fonts/',
        sprite: '../img/'
    },
    rename: { // Переименование
        css: 'dist/css/style.css',
        js: 'dist/js/scripts.js',
    },
    watch: { // Отслеживание изменений
        html: './src/**/*.html',
        js: './src/js/**/*.js',
        style: './src/styles/**/*.*',
        img: './src/img/**/*.*',
        fonts: './src/fonts/**/*.*'
    },
    clean: './dist' // Удаление продакшена
};

// Настройки сервера
const config = {
    server: {
        baseDir: "./dist"
    },
    open: false,
    tunnel: true,
    notify: false,
    host: 'localhost',
    port: 9000,
    logPrefix: "Frontend"
};

// Сборка html
gulp.task('html', function () {
    gulp.src(path.src.html) //Выберем файлы по нужному пути
        .pipe(rigger()) //Прогоним через rigger
        .pipe(gulp.dest(path.dist.html)) //Выплюнем их в папку dist
        .pipe(reload({stream: true})); //И перезагрузим наш сервер для обновлений
});

// Сборка стилей
gulp.task('style', function () {
    gulp.src(path.src.styles + 'style.*') //Выберем наш style.less
        .pipe(sourcemaps.init()) //Инициализируем sourcemap
        .pipe(preprocessor.base()) //Скомпилируем
        .pipe(autoprefixer({ //Добавим вендорные префиксы
            browsers:['ie >= 9', 'last 3 version'],
            cascade: false
        })) 
        .pipe(gcmq()) //Сгруппируем медиа запросы
        .pipe(sourcemaps.write()) //Пропишем карты
        .pipe(gulp.dest(path.dist.css)) //В dist
        .pipe(reload({stream: true})); //И перезагрузим сервер
});

// Сборка js
gulp.task('js', function () {
    gulp.src(path.src.js) //Найдем наш main файл
        .pipe(rigger()) //Прогоним через rigger
        .pipe(sourcemaps.init()) //Инициализируем sourcemap
        .pipe(sourcemaps.write()) //Пропишем карты
        .pipe(gulp.dest(path.dist.js)) //Выплюнем готовый файл в dist
        .pipe(reload({stream: true})); //И перезагрузим сервер
});

// Сжатие изображений
gulp.task('image', function () {
    gulp.src(path.src.img + '*.*') //Выберем наши картинки
        .pipe(imagemin({ //Сожмем их
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()],
            interlaced: true
        }))
        .pipe(gulp.dest(path.dist.img)) //И бросим в dist
        .pipe(reload({stream: true})); //И перезагрузим сервер
});

// Переброска шрифтов в dist
gulp.task('fonts', function() {
    gulp.src(path.src.fonts)
        .pipe(gulp.dest(path.dist.fonts))
});

// Сжатие css
gulp.task('minify:css', function() {
    gulp.src(path.rename.css) 
        .pipe(cleancss({ //Сожмем
            level : 2
        })) 
        .pipe(rename({ //Переименуем
            suffix: ".min"
        }))
        .pipe(gulp.dest(path.dist.css)) //И бросим в dist
});

// Сжатие js
gulp.task('minify:js', function() {
    gulp.src(path.rename.js) 
        .pipe(uglify()) //Сожмем наш js
        .pipe(rename({ // Переименуем
            suffix: ".min"
        }))
        .pipe(gulp.dest(path.dist.js)) //И бросим в dist
});

// Слежение за изменениями
gulp.task('watch', function(){ //Отслеживать изменения
    watch([path.watch.html], function(event, cb) {
        gulp.start('html');
    });
    watch([path.watch.style], function(event, cb) {
        gulp.start('style');
    });
    watch([path.watch.js], function(event, cb) {
        gulp.start('js');
    });
    watch([path.watch.img], function(event, cb) {
        gulp.start('image');
    });
    watch([path.watch.fonts], function(event, cb) {
        gulp.start('fonts');
    });
});

gulp.task('server', function () { //Запустить локальный сервер
    browserSync(config);
});

gulp.task('build', ['html','js','style','fonts','image']); //Собрать все файлы в dist

gulp.task('clean', function (cb) { //Удалить dist
    del.sync([path.clean], cb);
});

// Создание спрайтов
gulp.task('sprite', function () {
    var fileName = 'sprite.png'
    var pre = String(preprocessor.base)
    var spriteData = gulp.src(path.src.sprite) // Выбираем картинки
        .pipe(spritesmith({ // Создаем спрайт
            imgName: fileName,
            cssName: 'sprite' + preprocessor.extension,
            cssFormat: +preprocessor.base,
            algorithm: 'binary-tree',
            cssVarMap: function (sprite) {
                sprite.name = 'icon-' + sprite.name;
            },
            imgPath: path.dist.sprite + fileName
        }));
    spriteData.img
        .pipe(gulp.dest(path.src.img)); // Бросаем готовый спрайт в dist
    spriteData.css
        .pipe(gulp.dest(path.src.styles)); // Бросаем стили спрайта в dist
    return spriteData;
});

gulp.task('default', ['build', 'server', 'watch']); //Запустить всю сборку

gulp.task('minify', ['minify:css','minify:js']); //Сжать css и js