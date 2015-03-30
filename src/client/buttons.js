"use strict"

define(['jquery', 'FileSaver', 'rz_core', 'rz_api_backend'],
function ($, saveAs, rz_core, rz_api_backend) {
$('.tutorial').click(function(){});

var key="#47989379";


$('.save a').click(function(){
    var json = rz_core.main_graph.save_to_json();
    console.log('saving to local storage ' + json.length + ' bytes');
    localStorage.setItem(key, json);
});

$('#btn_export').click(function() {
    var json = rz_core.main_graph.save_to_json();
    var filename = 'graph.json';
    var blob = new Blob([json], {type: 'application/json'});
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
    return confirm('All unsaved changes will be deleted, are you sure?');
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
    close_btn = $('<span class="cmd-bar_btn" id="cmd_bar__rzdoc_close">x</span>');
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

        var on_success = function (clone_obj) {

            cmd_bar.fadeToggle(200, function() {
                cmd_bar.remove();
            });

            rz_core.rzdoc_open(rzdoc_name);
        };

        var on_error = function() {
            // TODO: handle doc already exists
            // TODO: handle malformed doc name
        };

        // TODO: validate rzdoc name
        var rzdoc_name = $('#cmd_bar__rzdoc_new__input').val();
        rz_api_backend.rzdoc_create(rzdoc_name, on_success, on_error);
    });

    submit_btn.keyup(function(event) { // create on Enter key pressed
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
});

return {'buttons': 'nothing here'};
}); // define
