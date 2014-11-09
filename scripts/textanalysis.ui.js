"use strict"

define('textanalysis.ui', ['autocomplete', 'rhizicore', 'textanalysis', 'signal', 'consts'],
       function(autocomplete, RZ, textanalysis, signal, consts) {
var text = ""; // Last text of sentence
var element_name = '#textanalyser';
var element = $(element_name);
var suggestionChange;

function analyzeSentence(sentence, finalize)
{
    var ret = textanalysis.textAnalyser(sentence, finalize);

    switch (ret.state) {
    case textanalysis.ANALYSIS_NODE_START:
        $('.typeselection').css({top:window.innerHeight/2-115,left:window.innerWidth/2-325});
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>Use [TAB] key to pick a type</td></tr></table>');
        break;
    case textanalysis.ANALYSIS_LINK:
        $('.typeselection').css('top', -300);
        $('.typeselection').css('left', 0);
        break;
    }
    ret.applyToGraph(RZ.graph);
    if (finalize || sentence.length == 0) {
        $('.typeselection').css('top', -300);
        $('.typeselection').css('left', 0);
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

function changeType(arg, id) {
    var typeindex;
    var lastnode = textanalysis.lastnode();
    var nodetype;

    if(!id) {
        id = "new node";
    }
    typeindex = (arg === 'up'? textanalysis.typeindex_next() : textanalysis.typeindex_prev());
    nodetype = textanalysis.nodetypes()[typeindex];

    if (arg === 'up') {
        RZ.graph.editType(id, null, nodetype);
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetype + '</td></tr></table>');
        RZ.graph.findCoordinates(lastnode, null);
    } else {
        RZ.graph.editType(id, null, nodetype);
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetype + '</td></tr></table>');
        RZ.graph.findCoordinates(lastnode, null);
    }
    RZ.graph.update(true);
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
            open: function() {
                $('.ui-autocomplete').css('width', '10px');
            }
        });

        $(document).keydown(function(e) {
            signal.signal(consts.KEYSTROKES, [{where: consts.KEYSTROKE_WHERE_DOCUMENT, keys: [e.keyCode]}]);
            if (e.keyCode == 9) {//TAB
                e.preventDefault();
                changeType(e.shiftKey ? "up" : "down", textanalysis.lastnode());
                return false;
            }

            if (e.keyCode == 37) {//UP
                  $('html, body').scrollLeft(0);
            }
            if (e.keyCode == 39) {//DOWN
                  $('html, body').scrollLeft(0);
            }

            if (e.keyCode == 38) {//UP
                suggestionChange = true;
            }
            if (e.keyCode == 40) {//DOWN
                suggestionChange = true;
            }

            if (e.keyCode == 9) {//TAB
                return false;
            }
        });

        element.keypress(function(e) {
            signal.signal(consts.KEYSTROKES, [{where: consts.KEYSTROKE_WHERE_TEXTANALYSIS, keys:[e.which]}]);
            if (e.which == 13) {
                if(!suggestionChange) {
                    text = element.val();
                    element.val("");
                    analyzeSentence(text, true);
                } else {
                    suggestionChange = false;
                }
                return false;
            }

            if (e.which == 37) {//RIGHT
                $('body').scrollLeft(0);
                e.stopPropagation();
                return false;
            }
            if (e.which == 39) { //LEFT
                $('body').scrollLeft(0);
                e.stopPropagation();
                return false;
            }
        });

        if ('oninput' in document.documentElement) {
            element.on('input', function(e) {
                text = element.val();
                analyzeSentence(text, false);
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
