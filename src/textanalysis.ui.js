"use strict"

define(['jquery', 'Bacon', 'consts', 'rz_bus', 'autocomplete', 'rz_core', 'textanalysis'],
function($,        Bacon,   consts,   rz_bus,   autocomplete,   rz_core,   textanalysis) {

var text = "", // Last text of sentence
    element_name = '#textanalyser',
    element = $(element_name),
    suggestionChange,
    plus_button = $('.add-button'),
    description = consts.description;

var typeselection = function TypeSelectionDialog() {
    var e = $('.typeselection'),
        typeselection = {};

    typeselection.analysisNodeStart = function() {
        typeselection.show();
        e.html('<table><tr><td style="height:28px"></td></tr><tr><td>Use [TAB] key to pick a type</td></tr></table>');
    }
    typeselection.show = function() {
        e.css({
            top: window.innerHeight/2-115,
            left: window.innerWidth/2-325});
    }
    typeselection.hide = function() {
        e.css('top', -300);
        e.css('left', 0);
    }
    typeselection.showChosenType = function(nodetype) {
        var desc = description[nodetype];
        e.html('<table><tr><td style="height:28px"></td></tr><tr><td>' +
               "Chosen Type: " + nodetype + '</td></tr>' +
               (desc ? '<tr><td>' + desc + '</td></tr>' : '') +
               '</table>');
    }
    return typeselection;
}();

function analyzeSentence(sentence, finalize)
{
    var ret = textanalysis.textAnalyser(sentence, finalize);

    switch (ret.state) {
    case textanalysis.ANALYSIS_NODE_START:
        typeselection.analysisNodeStart();
        break;
    case textanalysis.ANALYSIS_LINK:
        typeselection.hide();
        break;
    }

    var backend_commit = false;
    ret.applyToGraph(rz_core.graph, backend_commit);

    if (finalize || sentence.length == 0) {
        typeselection.hide();
        $('span.ui-helper-hidden-accessible').hide();
    } else {
        $('span.ui-helper-hidden-accessible').show();
    }
}

function textSelect(inp, s, e) {
    e = e || s;
    if (inp.createTextRange) {
        var r = inp.createTextRange();
        r.collapse(true);
        r.moveEnd('character', e);
        r.moveStart('character', s);
        r.select();
    }else if(inp.setSelectionRange) {
        inp.focus();
        inp.setSelectionRange(s, e);
    }
}

function changeType(arg) {
    var lastnode = textanalysis.lastnode(),
        nodetype,
        id;

    if(!lastnode) {
        id = "new node";
    } else {
        id = lastnode.id;
    }
    nodetype = (arg === 'up'? textanalysis.selected_type_next() : textanalysis.selected_type_prev());

    if (arg === 'up') {
        rz_core.graph.editType(id, null, nodetype);
        typeselection.showChosenType(nodetype);
        rz_core.graph.findCoordinates(id, null);
    } else {
        rz_core.graph.editType(id, null, nodetype);
        typeselection.showChosenType(nodetype);
        rz_core.graph.findCoordinates(id, null);
    }
    rz_core.update_view__graph(true);
}

return {
    analyzeSentence: analyzeSentence,
    main:function () {
        if (element.length != 1) {
            return;
        }

        element.autocompleteTrigger({
            triggerStart: '#',
            triggerEnd: '',
            source: textanalysis.autocompleteCallback,
            response: function(element, ui) {
                ui.content.forEach(function (x) {
                    if (x.value.search(' ') != -1) {
                        x.value = '"' + x.value + '"';
                    }
                });
            },
            open: function() {
                $('.ui-autocomplete').css('width', '10px');
            },
        });

        var document_keydown = new Bacon.Bus();
        rz_bus.ui_key.plug(document_keydown);

        element.keydown(function(e) {
            var ret = undefined;

            switch (e.keyCode) {
            case 9: //TAB
                if (textanalysis.lastnode()) {
                    e.preventDefault();
                    changeType(e.shiftKey ? "up" : "down", textanalysis.lastnode());
                    ret = false;
                }
                break;
            case 37: //UP
                $('html, body').scrollLeft(0);
                break;
            case 39: //DOWN
                $('html, body').scrollLeft(0);
                break;
            case 38: //UP
                suggestionChange = true;
                break;
            case 40: //DOWN
                suggestionChange = true;
                break;
            }
            document_keydown.push({where: consts.KEYSTROKE_WHERE_DOCUMENT, keys: [e.keyCode]});
            return ret;
        });

        function maybeSubmitNewSentence() {
            if(!suggestionChange) {
                text = element.val();
                element.val("");
                analyzeSentence(text, true);
                text = "";
            } else {
                suggestionChange = false;
            }
        }

        // Click is required to prevent the default action - this is a form so that's a post,
        // and away we go.
        // The mousedown is required because CSS3 transitions eat some events sometimes. This is
        // the closest I've come to an explanation:
        //   http://stackoverflow.com/questions/15786891/browser-sometimes-ignores-a-jquery-click-event-during-a-css3-transform
        plus_button.bind("click mousedown", function(e) {
            console.dir(e);
            maybeSubmitNewSentence();
            e.preventDefault();
        });

        var element_keydown = new Bacon.Bus();
        rz_bus.ui_key.plug(element_keydown);
        element.keydown(function(e) {
            var ret = undefined;
            switch (e.which) {
            case 13:
                maybeSubmitNewSentence();
                ret = false;
                break;
            case 37: //RIGHT
                $('body').scrollLeft(0);
                e.stopPropagation();
                ret = false;
                break;
            case 39: //LEFT
                $('body').scrollLeft(0);
                e.stopPropagation();
                ret = false;
                break;
            }
            element_keydown.push({where: consts.KEYSTROKE_WHERE_TEXTANALYSIS, keys:[e.which]});
            return ret;
        });

        var input = new Bacon.Bus();
        rz_bus.ui_input.plug(input);
        if ('oninput' in document.documentElement) {
            element.on('input', function(e) {
                text = element.val();
                analyzeSentence(text, false);
                input.push({where: consts.INPUT_WHERE_TEXTANALYSIS, input: text});
            });
        } else {
            console.log('textanalysis.ui: fallback to polling');
            window.setInterval(function() {
                if (element.val() != text) {
                    if (text.length * 8 > 500) {
                        element.css('width', text.length * 8 + 20);
                    }
                    // text changed
                    text = element.val();
                    analyzeSentence(text, false);
                    suggestionChange = false;
                }
            }, 50);
        }
    }
};
}); // define
