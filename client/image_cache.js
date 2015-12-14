define(
        [],
function() {

"use strict";

var cache = {};

function element_set_image__after_load(e, image) {
    var aspect = image.height / image.width,
        width = Math.min(100, image.width);

    e.setAttribute("width", width);
    e.setAttribute("height", Math.min(width * aspect, image.height));
    e.setAttributeNS("http://www.w3.org/1999/xlink", "href", image.src);
}

function element_set_image(e, url) {
    var image;

    if (cache[url] === undefined) {
        image = new Image();
        image.onload = function () {
            element_set_image__after_load(e, image);
            cache[url] = image; // caching only after image is loaded
        };
        image.src = url;
    } else {
        element_set_image__after_load(e, cache[url]);
    }
}

return {
    element_set_image: element_set_image
};
});
