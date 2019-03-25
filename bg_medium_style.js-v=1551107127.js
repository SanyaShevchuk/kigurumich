/**
 * Created by артём on 06.06.2017.
 */
;(function (w) {

    var sections = $(".blk_section.bg_type_image .section-image").filter(function () {
            var bgUrl = cleanBgUrl($(this).css("background-image"));
            //svg пропускаем
            return bgUrl.split('.').pop() != 'svg';
        })
        , wnd = $(w)
        , imgId_attrs = {}
        , adaptMan = {}
        , paddingToStartLoad = 100
        , allObjects
        , currentObjectKey
        , isCheckPosition = false
        ;

    function cleanBgUrl (url) {
        var res = url;
        if ('undefined' !== typeof url && null!==url){
            res = url
                .replace(/^\s+/,'')
                .replace(/\s+$/,'')
                .replace(/^url\s*\(\s*/,'')
                .replace(/\s*\)\s*/,'')
                .replace(/^[\s'"]+/g, '')
                .replace(/[\s'"]+$/g, '')
                .replace(/\?\d+$/g, '');
        }

        return res;
    }

    //function setCachedImages () {
    //    allObjects.each(function (key) {
    //        var imageSrc = $(this).css('background-image')
    //            , cleanImgSrc = removeUrlApiStr(cleanBgUrl(imageSrc));
    //
    //        if (hasImageInCache(cleanImgSrc) && false){
    //            // если картинка есть в кеше - устанавливаем её
    //            $(this).css('background-image', 'url("' + removeUrlApiStr(cleanImgSrc) + '")');
    //            //и удаляем из набора блоков, которые надо конвертнуть
    //            delete allObjects[key];
    //            allObjects.length = allObjects.length - 1;
    //        }
    //    })
    //}

    function init() {
        var temp = {}
        allObjects = $(sections);
        allObjects.each(function () {
            temp[$(this).attr('id')] = $(this)
        })
        if (!$.isEmptyObject(temp)) {
            allObjects = temp;
        }
        adaptMan = w.adapterManager;
    }


    function __run (blk) {
        setTimeout(function () {
            if(blk.hasClass('section-image')) {
                loadSection(blk)
            }
        }, 1);
    }

    function checkPosition ($blk, key) {
        var blk = $blk
            , minA, maxA, wndMin, wndMax;

        currentObjectKey = key;

        minA =  blk.offset().top;
        maxA =  minA + parseInt(blk.css("height"));
        wndMin = wnd.scrollTop();
        wndMax = wndMin + w.innerHeight;

        if (
            ( wndMin - paddingToStartLoad < maxA  && maxA < wndMax + 100 )||
            ( wndMin < minA && maxA < wndMax ) ||
            ( wndMax + paddingToStartLoad > minA && maxA > wndMax )
        ) {
            return true;
        }
    }

    function imageFade(isCheckPosition) {
        if (Object.keys(allObjects).length && !adaptMan.processResizing) {

            $.each(allObjects, function (key, block) {
                if (isCheckPosition) {
                    if (checkPosition($(this), key)) {
                        __run($(this));
                        delete allObjects[key]
                    }
                } else {
                    __run($(this), key);
                    delete allObjects[key]
                }
            })
        }
    }

    function hasImageInCache( src ) {
        var img = new Image();
        img.src = src;

        return img.complete;
    }

    function removeUrlApiStr (src) {
        return src.replace(/(.*\/\w\/\w\/\w\/\w{32}).*(\.(png|jpg|jpeg))/, "$1$2");
    }

    function loadSection ($section) {
        var imageSrc = $section.css('background-image');
        var cleanImgSrc = removeUrlApiStr(cleanBgUrl(imageSrc));

        if (cleanImgSrc === 'none') {
            return;
        }

        var imgProps = $section.prop('attributes');
        var isInCache = hasImageInCache(cleanImgSrc);
        var animationTime = 'slow';

        //if (isInCache) {
        //    // если картинка есть в кеше - устанавливаем её
        //    $section.css('background-image', 'url("' + removeUrlApiStr(cleanImgSrc) + '")');
        //    //и выходим из ф-ии
        //    return;
        //}

        wrapByAbsoluteContainer($section);
        $("<img />")
            .attr("src", cleanImgSrc)
            .one('load', function () {
                var resultImg = $("<div></div>");
                $.each(imgProps, function() {
                    resultImg.attr(this.name, this.value);
                });
                resultImg.hide();
                resultImg.css('background-image', 'url("' + cleanImgSrc + '")');
                resultImg.insertAfter($section);

                resultImg.fadeIn(animationTime, function () {
                    resultImg.unwrap();
                    $section.remove();
                })
            })

    }


    function wrapByAbsoluteContainer (blk) {
        blk.wrap("<div class='ms__wrapper_abs'></div>");
    }

    FE.runOnObjectReady("adapterManager", function () {
        init();
        imageFade(true);
        imageFade();
    })

})(window);