"use strict"

define(['jquery', 'Bacon_wrapper'],
function($,        Bacon) {

function Tab(dict) {
    var k,
        selector = {},
        name = [],
        openessBus = new Bacon.Bus();

    for (k in dict) {
        if (dict.hasOwnProperty(k) == false) {
            continue;
        }
        selector[k] = dict[k];
        name.push(k);
    }
    this._selector = selector;
    this._name = name;
    this._openessBus = openessBus;
    this.isOpenProperty = openessBus.toProperty(false)
}

Tab.prototype.show = function(shown_name) {
    var i,
        name,
        element;

    for (i = 0 ; i < this._name.length ; ++i) {
        name = this._name[i];
        element = $(this._selector[name]);
        if (name === shown_name) {
            element.fadeIn(300);
        } else {
            element.hide();
        }
    }
    this._openessBus.push(true);
}

Tab.prototype.hide = function() {
    var i;

    for (i = 0 ; i < this._name.length ; ++i) {
        $(this._selector[this._name[i]]).fadeOut(300);
    }
    this._openessBus.push(false);
}

Tab.prototype.get = function(name, sel) {
    // selector concatenation
    var e = $(this._selector[name] + ' ' + sel);

    return e;
}

return {
    Tab: Tab
};

});
