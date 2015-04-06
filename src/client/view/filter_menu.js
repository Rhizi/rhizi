define(['jquery'],
function($) {
    
var open_button = $('#btn_filter'),
    menu = $('#menu__type-filter');

return {
    init: function () {
        open_button.on('click', function (e) {
            menu.toggle();
        });
    },
    hide: function () {
        menu.hide();
    },
};
});
