define(['Bacon', 'jquery', 'underscore', 'model/types', 'util'],
function(Bacon,   $,        _,            model_types,   util) {

var filter_states_bus = new Bacon.Bus();

function init() {
    function create_checkboxes() {
        var root = $('#menu__type-filter');

        _.each(model_types.nodetypes, function (type) {
            var input = $('<input type="checkbox" checked="checked">'),
                div = $('<div class="menu__type-filter_item"></div>');

            input.attr("name", type);
            div.append(input);
            div.append(util.capitalize(model_types.node_titles[type]));
            root.append(div);
        });
    }

    function read_checkboxes() {
        var name,
            value,
            // FIXME take filter names from index.html or both from graph db
            filter_states = _.object(_.map(model_types.nodetypes, function (type) { return [type, null]; }));
            // jquery map does flattens, and we don't want that
            checkboxes = _.map($('#menu__type-filter input'),
                function (checkbox) {
                        return [checkbox.name, checkbox.checked];
                    }
                );
        for (var i in checkboxes) {
            name = checkboxes[i][0];
            value = checkboxes[i][1];
            if (undefined === filter_states[name]) {
                continue;
            }
            filter_states[name] = value;
        }
        return filter_states;
    }

    create_checkboxes();
    read_checkboxes();
    function filtered_states() {
        var o = read_checkboxes(),
            ret = {};

        _.each(_.keys(o), function(type) {
            if (!o[type]) {
                ret[type] = 1;
            }
        });
        return ret;
    }
    //$('.menu__type-filter_item,.menu__type-filter_item input')
    $('#menu__type-filter')
        .asEventStream('click')
        .onValue(function (e) {
            var inp = $(e.target).find('input')[0];

            if (inp && inp.checked !== undefined) {
                inp.checked = !inp.checked;
                e.preventDefault();
            }
            e.stopPropagation();
            filter_states_bus.push(filtered_states());
        });
}

return {
    init: init,
    filter_states_bus: filter_states_bus,
};
});
