/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict"

define(['jquery', 'rz_core', 'FileSaver'],
function($, rz_core, file_saver) {

    var import_file_set;

    $('debug-view__save').click(function(){
        var json = rz_core.main_graph.save_to_json();
        console.log('saving to local storage ' + json.length + ' bytes');
        localStorage.setItem(key, json);
    });

    $('#debug-view__export_btn').click(function() {
        var json = rz_core.main_graph.save_to_json(),
            blob = new Blob([json], {type: 'application/json'}),
            now = new Date(),
            date_string = ('' + now.getYear() + now.getMonth() + now.getDay() + '-' +
                now.getHours() + now.getMinutes() + now.getSeconds()),
            filename = rz_config.rzdoc_cur__name + '-' + date_string + '.json';

        console.log('saving ' + json.length + ' bytes to ' + filename);
        file_saver(blob, filename);
    });

    $('#debug-view__url-copy a').click(function() {
        var json = rz_core.main_graph.save_to_json();
        // TODO use jquery BBQ $.param({json: json});
        var encoded = document.location.origin + '/?json=' + encodeURIComponent(json);
        window.prompt('Copy to clipboard: Ctrl-C, Enter (or Cmd-C for Mac)', encoded);
    });

    var confirm_import = function() {
      if (!rz_core.main_graph.empty()) {
        return confirm('Current work will be merged with the new import, are you sure?');
      }
      return true;
    }

    function import_file(file) {

        var file_reader;

        console.log(file);
        file_reader = new FileReader();
        file_reader.onload = (function(theFile) {
            return function(e) {
                var result = e.target.result;
                if (e.target.readyState === FileReader.DONE) {
                    console.log('file-import: done reading \'' + theFile.name + '\', byte count: ' + result.length);
                    rz_core.load_from_json(result);
                }
            }
        })(file);
        file_reader.readAsText(file, "text/javascript");
    }

    function init_import_handlers() {

        /*
         * step1: propagate import file selection to hidden input element
         */
        $('#devtools__import__select-files-btn').click(function(event) {

            $('#debug-view__import__input_element').click(); // trigger file selection dialog

        });

        /*
         * step2: handle file selection events, enable import-execution button
         */
        $('#debug-view__import__input_element').on('change', function(event) {

            import_file_set = event.target.files;

            if (undefined === import_file_set) {
                return;
            }

            $('#debug-view__import__file-list').children().remove();
            $.map(import_file_set, function(file){

                var e_file_path;

                e_file_path = $('<div>');
                e_file_path.addClass('debug-view__import__input_file_name')
                e_file_path.text('- ' + file.name);
                $('#debug-view__import__file-list').append(e_file_path);
            });

            $('#devtools__import__step__export').show(); // enable import exec button
        });

        /*
         * step3: prompt for confirmation & execute import
         */
        $('#devtools__import__execute-import-btn').click(function(event) {
            if (!confirm_import()) {
                return;
            }

            $.map(import_file_set, import_file);
        });
    };
    init_import_handlers();

    $('debug-view__local-storage-load').click(function(){
      if (!confirm_import()) {
          return;
      }
      var json_blob = localStorage.getItem(key)
      rz_core.load_from_json(json_blob);
    });

    return {
        
    }
});