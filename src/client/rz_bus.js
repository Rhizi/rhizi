"use strict"

define(['consts', 'Bacon'],
function(consts,   Bacon)
{
    var ui_key_bus = new Bacon.Bus(),
        ui_input_bus = new Bacon.Bus();

    return {
        ui_key: ui_key_bus,
        ui_input: ui_input_bus,
    };
});
