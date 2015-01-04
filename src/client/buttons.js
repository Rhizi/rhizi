"use strict"

define(['jquery', 'FileSaver', 'rz_core'], function ($, saveAs, rz_core) {
$('.tutorial').click(function(){});

var key="#47989379";


$('.save a').click(function(){
    var json = rz_core.main_graph.save_to_json();
    console.log('saving to local storage ' + json.length + ' bytes');
    localStorage.setItem(key, json);
});

$('.export').click(function() {
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

var logout_button = $('#logout-button');
logout_button.click(function() {
    $.ajax({ type: "POST", url: '/logout'}); // server should redirect back to /login
});

$('a.save-history').click(function() {
    if (rz_core.main_graph.history === undefined) {
        throw "History is undefined";
    }
    rz_core.main_graph.history.save_to_file();
});
return {'buttons': 'nothing here'};
}); // define
