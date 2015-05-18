"use strict"

/**
 * Manage backend websocket connection
 */
define(['jquery'],
function($) {

    var close_btn,
        toolbar__status;

    function toolbar__status() {

        close_btn = $('<div>x</div>');
        close_btn.addClass('toolbar__close_btn');

        toolbar__status = $('#status-bar');
        toolbar__status.append(close_btn);
    }

    /**
     * display given HTML fragment as status line body
     */
    function display_html_frag(toolbar__status_body) {
        toolbar__status.children().remove();

        toolbar__status.append(close_btn);
        toolbar__status.append(toolbar__status_body);
        toolbar__status_body.addClass('status-bar__body');

        close_btn.click(function() {
            toolbar__status.hide();
        });

        toolbar__status.show();
    }

    toolbar__status();

    return {
        display_html_frag : display_html_frag,
        hide: function () {
            toolbar__status.hide();
        }
    };

});
