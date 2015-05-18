"use strict"

define(['jquery', 'FileSaver', 'rz_core', 'rz_api_backend', 'view/selection'],
function ($,       saveAs,      rz_core,   rz_api_backend,   selection) {
$('.tutorial').click(function(){});

var key="#47989379";


$('.save a').click(function(){
    var json = rz_core.main_graph.save_to_json();
    console.log('saving to local storage ' + json.length + ' bytes');
    localStorage.setItem(key, json);
});

$('#btn_export').click(function() {
    var json = rz_core.main_graph.save_to_json(),
        blob = new Blob([json], {type: 'application/json'}),
        now = new Date(),
        date_string = ('' + now.getYear() + now.getMonth() + now.getDay() + '-' +
            now.getHours() + now.getMinutes() + now.getSeconds()),
        filename = rz_config.rzdoc_cur__name + '-' + date_string + '.json';

    console.log('saving ' + json.length + ' bytes to ' + filename);
    saveAs(blob, filename);
});

$('.url-copy a').click(function() {
    var json = rz_core.main_graph.save_to_json();
    // TODO use jquery BBQ $.param({json: json});
    var encoded = document.location.origin + '/?json=' + encodeURIComponent(json);
    window.prompt('Copy to clipboard: Ctrl-C, Enter (or Cmd-C for Mac)', encoded);
});

var really_load = function() {
  if (!rz_core.main_graph.empty()) {
    return confirm('Current work will be merged with the new import, are you sure?');
  }
  return true;
}

$('.file-import').on('change', function(event) {
    var file = event.target.files[0];
    var reader;

    if (!really_load()) {
        return;
    }
    if (file === undefined) {
        return;
    }
    console.log(file);
    reader = new FileReader();
    reader.onload = (function(theFile) {
        return function(e) {
            var result = e.target.result;
            if (e.target.readyState === FileReader.DONE) {
                console.log('done reading ' + theFile.name);
                console.log('got #' + result.length + ' bytes in ' + typeof(result));
                rz_core.load_from_json(result);
            }
        }
    })(file);
    reader.readAsText(file, "text/javascript");
});

$('.local-storage-load a').click(function(){
  if (!really_load()) {
      return;
  }
  var json_blob = localStorage.getItem(key)
  rz_core.load_from_json(json_blob);
});

var logout_button = $('#btn-logout');
logout_button.click(function() {
    $.ajax({
        type: "POST",
        url: '/logout',
        success: function () {
            document.location = "/login";
        },
        error: function () {
            console.log("failed to logout");
            document.location = "/login";
        },
    }); // server should redirect back to /login
});

$('a.save-history').click(function () {
    if (rz_core.main_graph.history === undefined) {
        throw "History is undefined";
    }
    rz_core.main_graph.history.save_to_file();
});

$('#btn_rzdoc__new').click(function() {

    var cmd_bar,
        cmd_bar_body,
        submit_btn,
        close_btn;

    cmd_bar = $('#cmd_bar__rzdoc_new');
    if (cmd_bar.length > 0) { // cmd bar present
        cmd_bar.fadeToggle(400, function() {
            cmd_bar.remove();
        });
        return;
    }

    cmd_bar = $('<div class="cmd-bar" id="cmd_bar__rzdoc_new">');
    cmd_bar_body = $('<div class="cmd-bar_body" id="cmd_bar__rzdoc_new__body">');

    close_btn = $('<div id="cmd_bar__rzdoc_close">x</div>');
    close_btn.addClass('toolbar__close_btn');

    submit_btn = $('<span class="cmd-bar_btn" id="cmd_bar__rzdoc_new__submit">Create</span>');

    cmd_bar.append(close_btn);
    cmd_bar.append(cmd_bar_body);
    cmd_bar.append($('<div class="cmd-bar_close_bar">Create new Rhizi</div>'));

    cmd_bar_body.append('<label for="cmd_bar__rzdoc_new__input" id="cmd_bar__rzdoc_new__label">Rhizi Title:');
    cmd_bar_body.append('<input id="cmd_bar__rzdoc_new__input">');
    cmd_bar_body.append(submit_btn);

    cmd_bar.css('display', 'none');

    cmd_bar.insertAfter('.top-bar');

    // submit
    submit_btn.attr('tabindex', 1); // assume focus on next tab key press
    submit_btn.on('click', function() {
        var rzdoc_name = $('#cmd_bar__rzdoc_new__input').val();
        rz_core.rzdoc__create_and_open(rzdoc_name);
    });
    cmd_bar.on('keyup', function(event) { // create on Enter key pressed
        if(event.keyCode == 13) {
            submit_btn.click();
        }
    });

    // close
    close_btn.on('click', function() {
        cmd_bar.remove();
    });

    cmd_bar.fadeToggle(400);
});

$('#btn_rzdoc__open').click(function() {
    var cmd_bar,
        cmd_bar_body,
        close_btn;

    cmd_bar = $('#cmd_bar__rzdoc_open');
    if (cmd_bar.length > 0) { // cmd bar present
        cmd_bar.fadeToggle(400, function() {
            cmd_bar.remove();
        });
        return;
    }

    cmd_bar = $('<div class="cmd-bar" id="cmd_bar__rzdoc_open">');
    cmd_bar.css('display', 'none');

    close_btn = $('<div id="cmd_bar__rzdoc_close">x</div>');
    close_btn.addClass('toolbar__close_btn');
    close_btn.appendTo(cmd_bar);

    cmd_bar_body = $('<div class="cmd-bar_body" id="cmd_bar__rzdoc_open__rzdoc_list">');
    cmd_bar.append(cmd_bar_body);

    cmd_bar.append($('<div class="cmd-bar_close_bar">Open Rhizi</div>'));
    cmd_bar.insertAfter('.top-bar');

    // close
    close_btn.on('click', function() {
        cmd_bar.remove();
    });

    var on_success = function (rzdoc_name_list) {
        rzdoc_name_list.sort();
        for (var i = 0; i < rzdoc_name_list.length; i++) {
            var rzdoc_item = $('<div class="cmd_bar__rzdoc_open__item"><span title="Open Rhizi">' + rzdoc_name_list[i] + '</span></div>');
            cmd_bar_body.append(rzdoc_item);
        }
        $('.cmd_bar__rzdoc_open__item').on('click', function(click_event) { // attach common click handler
            var rzdoc_name = click_event.currentTarget.textContent;
            var rzdoc_cur_name = rz_core.rzdoc__current__get_name();
            if (rzdoc_name == rzdoc_cur_name) {
                console.log('rzdoc__open: ignoring request to reopen currently rzdoc: name: ' + rzdoc_cur_name);
                cmd_bar.remove();
                return;
            }

            rz_core.rzdoc__open(rzdoc_name);
        });
    }

    rz_api_backend.rzdoc_list(on_success); // TODO: handle doc list timeout
    cmd_bar.fadeToggle(400);
});

function log_scale(max_in, min_out, max_out) {
    var t = (min_out * max_out - 1) / (min_out + max_out - 2),
        k = 1 / max_in * Math.log((max_out - t) / (1 - t));

    return function (x) { return (1 - t) * Math.exp(x * k) + t; };
}

function exp_scale(max_in, min_out, max_out) {
    var t = (min_out * max_out - 1) / (min_out + max_out - 2),
        k = 1 / max_in * Math.log((max_out - t) / (1 - t));

    return function (y) { return (1 / k) * Math.log((y - t) / (1 - t)); };
}

function clip(min, max, v) {
    return Math.max(min, Math.min(max, v));
}

var zoom_range = 10,
    zoom_min = 0.1,
    zoom_max = 3,
    zoom_exp_to_linear = exp_scale(zoom_range, zoom_min, zoom_max);

$('#btn_zoom_in').asEventStream('click')
    .map(1)
    .merge($('#btn_zoom_out').asEventStream('click').map(-1))
    .map(function (change) {
        return clip(-zoom_range, zoom_range, zoom_exp_to_linear(rz_core.main_graph_view.zoom_obj.scale()) + change);
    })
    .map(log_scale(zoom_range, zoom_min, zoom_max))
    .onValue(function (val) {
        rz_core.main_graph_view.scale__absolute(val);
    });

$('#btn_zoom_to_selection').asEventStream('click')
    .map(selection.related_nodes)
    .onValue(function (selected) {
        rz_core.main_graph_view.nodes__user_visible(selected, true);
    });

return {'buttons': 'nothing here'};
}); // define
