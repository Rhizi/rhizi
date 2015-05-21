"use strict"

define(['jquery'],
function($) {

    function Cmd_bar(cmdbar_name) {

        var close_btn,
            cmdbar_name,
            root_div,
            body_div,
            footer_bar;

        this.cmdbar_name = cmdbar_name;

        close_btn = $('<div>x</div>');
        close_btn.addClass('toolbar__close_btn');

        body_div = $('<div>');
        body_div.attr('id', this.id_str() + '__body">');
        body_div.addClass('cmd-bar__body');

        root_div = $('<div>');
        root_div.attr('id', this.id_str());
        root_div.addClass('cmd-bar');
        root_div.css('display', 'none');

        footer_bar = $('<div>Create new Rhizi</div>')
        footer_bar.addClass('cmd-bar__close_bar');

        root_div.append(close_btn);
        root_div.append(body_div);
        root_div.append(footer_bar);

        close_btn.click(function() {
            root_div.hide();
        });

        this.body_div = body_div;
        this.root_div = root_div;
    }

    Cmd_bar.prototype.append_to_body = function(e) {
        this.body_div.append(e);
    }

    Cmd_bar.prototype.clear = function() {
        this.body_div.children().remove();
    }

    Cmd_bar.prototype.hide = function() {
        this.root_div.fadeToggle(400);
    }

    Cmd_bar.prototype.id_str = function(e) {
        return 'cmd-bar__' + this.cmdbar_name;
    }

    Cmd_bar.prototype.insert = function(remove_other_cmd_bars) {
        this.root_div.insertAfter('#top-bar');
    }

    Cmd_bar.prototype.remove = function(remove_other_cmd_bars) {
        this.root_div.insertAfter('#top-bar');
    }

    Cmd_bar.prototype.show = function() {
        this.root_div.fadeToggle(400);
    }

    function new_cmdbar(cmdbar_name) {
        return new Cmd_bar(cmdbar_name);
    }

    return {
        new_cmdbar: new_cmdbar,
    };

});
