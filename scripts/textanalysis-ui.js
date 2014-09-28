var text = ""; // Last text of sentence
var element_name = '#textanalyser';
var element = $(element_name);

element.autocompleteTrigger({
    triggerStart: '#',
    triggerEnd: '',
    source: autocompleteCallback
});

// TODO - hide this in a scope
function analyzeSentence(sentence, finalize)
{
    var ret = textAnalyser2(sentence, finalize);
    switch (ret.state) {
    case ANALYSIS_NODE_START:
        $('.typeselection').css({top:window.innerHeight/2-115,left:window.innerWidth/2-325});
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>Use [TAB] key to pick a type</td></tr></table>');
        break;
    case ANALYSIS_LINK:
        $('.typeselection').css('top', -300);
        $('.typeselection').css('left', 0);
        break;
    }
    ret.applyToGraph(graph);
    if (finalize || sentence.length == 0) {
        $('.typeselection').css('top', -300);
        $('.typeselection').css('left', 0);
    }
}


element.keypress(function(e) {
     if (graph.history !== undefined) {
         graph.history.record_keystrokes(KEYSTROKE_WHERE_TEXTANALYSIS, [e.which]);
     }
     if (e.which == 13) {
        if(!suggestionChange) {
            text = element.val();
            element.val("");
            analyzeSentence(text, true);
            typeStack = [];
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

$(document).keydown(function(e) {
  
    if (graph.history !== undefined) {
        graph.history.record_keystrokes(KEYSTROKE_WHERE_DOCUMENT, [e.KeyCode]);
    }
    if (e.keyCode == 9) {//TAB
        e.preventDefault();
        changeType("down", lastnode);
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
    if(!id) {
        id = "new node";
    }
    if (arg === 'up') {
        if (typeindex < 4) typeindex++;
        else typeindex = 0;
        graph.editType(id, null, nodetypes[typeindex]);
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetypes[typeindex] + '</td></tr></table>');
        graph.findCoordinates(lastnode,null);
    } else {
        if (typeindex > 0) typeindex--;
        else typeindex = 4;

        graph.editType(id, null, nodetypes[typeindex]);
        $('.typeselection').html('<table><tr><td style="height:28px"></td></tr><tr><td>' + "Chosen Type: " + nodetypes[typeindex] + '</td></tr></table>');
        graph.findCoordinates(lastnode,null);
    }
    graph.updateGraph();
}

if (element.length == 1) {
    /* TODO: don't use interval by default but only if keys are comming to fast (but still - 5 ms??) */
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
    }, 5);
}
