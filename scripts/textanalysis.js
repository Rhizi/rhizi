"use strict";

define('textanalysis', ['model/util', 'model/diff'], function(model_util, model_diff) {
var typeindex = 0;
var nodetypes = ["person", "project", "skill", "deliverable", "objective"];
var typeStack = [];

var lastnode;

var sugg = {}; // suggestions for autocompletion of node names

var ANALYSIS_NODE_START = 'ANALYSIS_NODE_START';
var ANALYSIS_LINK = 'ANALYSIS_LINK';

function autoSuggestAddName(name)
{
    /* note that name can contain spaces - this is ok. We might want to limit this though? */
    if(name.split(" ").length > 1) {
        sugg['"' + name + '"'] = 1;
    } else {
        sugg[name] = 1;
    }
}

function autocompleteCallback(request, response_callback)
{
    var ret = [];
    if (request.term === "" || request.term) {
        for (var name in sugg) {
            if (name.toLowerCase().indexOf(request.term.toLowerCase()) === 0) {
                ret.push(name);
            }
        }
    }
    response_callback(ret);
}

/* up_to_two_renames:
 *
 * allow one letter or 'new node' to anything changes */
function up_to_two_renames(graph, old_name, new_name)
{
    var not_one_letter = false;
    var k;
    /* Allowed renames:
     * no change
     * s1 is substring of s2
     * older (s1) node being 'new node'
     */
    function allowed_rename(s1, s2)
    {
        return (s1 == s2 ||
                s1 == 'new node' ||
                s1.substr(0, s2.length) == s2 ||
                s2.substr(0, s1.length) == s1);
    }

    if (old_name.length != new_name.length) {
        console.log('bug: up_to_two_renames: not equal inputs');
        return;
    }
    if (old_name.length > 2) {
        console.log('bug: up_to_two_renames: input length 2 < ' + old_name.length);
        return;
    }
    if (old_name.length == 2) {
        if (allowed_rename(old_name[0], new_name[1]) &&
            allowed_rename(old_name[1], new_name[0])) {
            old_name = [old_name[1], old_name[0]];
        } else {
            if (!allowed_rename(old_name[0], new_name[0]) ||
                !allowed_rename(old_name[1], new_name[1])) {
                not_one_letter = true;
            }
        }
    }
    if (not_one_letter) {
        console.log('bug: up_to_two_renames: not one letter changes');
        console.log(old_name);
        console.log(new_name);
        return;
    }
    for (k = 0 ; k < old_name.length ; ++k) {
        graph.editNameByName(old_name[k], new_name[k]);
    }
}

// TODO: add escape char, i.e. r"bla\"bla" -> ['bla"bla']
function tokenize(text, node_token, quote)
{
    var segment = [],
        subsegment = [],
        sentence = [],
        quoteword;
    var j;

    segment = text.split(node_token);
    for (j = 0; j < segment.length; j++) {
        if (j !== 0) sentence.push(node_token);
        subsegment = segment[j].split(" ");
        if (subsegment.length === 0) {
            sentence.push(" ");
        }
        for (var k = 0; k < subsegment.length; k++) {
            if (subsegment[k] !== " " && subsegment[k] !== "") {
                if (subsegment[k].charAt(0) === quote) {
                    quoteword = "";
                    do {
                        quoteword += subsegment[k] + ' ';
                        if(subsegment[k].charAt(subsegment[k].length-1) !== quote)k++;
                    } while (k < subsegment.length && subsegment[k].charAt(subsegment[k].length - 1) !== quote);
                    if (subsegment[k] && subsegment[k]!==quoteword.replace(/ /g, "")) {
                        quoteword += subsegment[k];
                    }
                    sentence.push(quoteword.replace(new RegExp(quote, 'g'), ""));
                } else {
                    sentence.push(subsegment[k]);
                }
            }
        }
    }
    return sentence;
}

/*
 * textAnalyser
 *
 * Input:
 *  @newtext - new sentence
 *  @finalize - is this an intermediate editing state or are we editing the graph
 *
 * Output:
 *  none
 *
 * Side effect:
 *  updating graph (global)
 *
 * Implementation notes:
 *  There is no well defined grammer. The translation goes from obvious to not
 *  so much for more complex sentences involving more then two nodes (two '#'
 *  marks).
 *
 */
var textAnalyser = function (newtext, finalize) {
    var sentence,
        newlinks = [],
        newnodes = [],
        linkindex = 0,
        nodeindex = 0,
        orderStack = [],
        and_count = 0,
        prefix = "",
        ret = {'nodes': [], 'links': []},
        m,
        word,
        completeSentence,
        typesetter, starGraph,
        n,
        link_hash = {},
        yell_bug = false, // TODO: fix both issues
        NODE = "NODE",
        LINK = "LINK",
        START = "START";

    function addNode(name, type, state) {
        if (type === undefined) {
            console.log('bug: textanalyser.addNode of type undefined');
        }
        ret.nodes.push({'name':name, 'type':type, 'state':state});
    }
    function addLink(src, dst, name, state) {
        if (!src || !dst) {
            if (yell_bug) {
                console.log('bug - adding link (' + src + ', ' + dst + ')');
            }
            return;
        }
        if (link_hash[src] && link_hash[src][dst]) {
            if (yell_bug) {
                console.log('bug - adding link twice (' + src + ', ' + dst + ')');
            }
            return;
        }
        if (!link_hash[src]) {
            link_hash[src] = {};
        }
        link_hash[src][dst] = 1;
        ret.links.push({'sourceName':src, 'targetName':dst, 'name':name ? name.trim() : "", 'state':state});
    }

    //Sentence Sequencing
    //Build the words and cuts the main elements
    sentence = tokenize(newtext, '#', '"');

    //BUILD NEW NODE AND LINK ARRAYS WITH ORDER OF APPEARENCE
    for (m = 0; m < sentence.length; m++) {
        switch (sentence[m]) {
        case "#":
            orderStack.push(START);
            break;
        case "and":
        case "+":
        case ",":
        case "&":
            sentence[m] = "and";
            and_count++;
            //orderStack.push("AND");
        default:
            if (orderStack[orderStack.length - 1] === START) {
                orderStack.push(NODE);
                newnodes.push(sentence[m]);
                linkindex++;
            } else if (orderStack[orderStack.length - 1] === NODE) {
                orderStack.push(LINK);
                if (!newlinks[linkindex]) {
                    newlinks[linkindex] = sentence[m] + " ";
                } else {
                    newlinks[linkindex] += sentence[m] + " ";
                }
            } else {
                if (!newlinks[linkindex]) {
                    newlinks[linkindex] = sentence[m] + " ";
                } else {
                    newlinks[linkindex] += sentence[m] + " ";
                }
            }
            if (newnodes.length === 0) {
                prefix += (prefix.length > 0 ? ' ' : '') + sentence[m];
            }
            break;
        }
    }

    starGraph = (newlinks.length - and_count) >= 3  ||
        ((newlinks.length - and_count >= 1) &&
         newlinks.length > 2 &&
         orderStack.length > 1 &&
         orderStack[orderStack.length - 1] != NODE);

    //PREFIX not null case - put complete sentence in first link.
    if (prefix && !starGraph) {
        newlinks[1] = prefix + " " + newnodes[0] +
        (newlinks[1] !== undefined || newnodes[1] !== undefined ?
        " " : "")
        + (newlinks[1] !== undefined ? newlinks[1] : "")
        + (newnodes[1] !== undefined ? newnodes[1] : "");
    }

    //WRITE COMPLETE SENTENCE
    linkindex = 0;
    nodeindex = 0;
    word = "";
    completeSentence = prefix.length > 0 ? String(prefix) + " " : "";
    for (m = 0; m < orderStack.length; m++) {
        if (orderStack[m] === NODE) {
            word += " (" + newnodes[nodeindex] + ") ";
            completeSentence += newnodes[nodeindex] + " ";
            nodeindex++;
        } else if (orderStack[m] === LINK) {
            word += " -->" + newlinks[nodeindex] + " --> ";
            completeSentence += newlinks[nodeindex];
        }
    }
    completeSentence = completeSentence.trim();

    //REBUILD GRAPH
    linkindex = 0;
    nodeindex = 0;

    //CHANGE TO PERMANENT STATE AND UPDATE SUGGESTIONLIST
    typesetter = "";
    if (finalize === true) {
        typesetter = "perm";
        for (n = 0; n < newnodes.length; n++) {
            autoSuggestAddName(newnodes[n]);
        }
    } else {
        typesetter = "temp";
    }

    //ADD SURROUNDING BUBBLE
    if (orderStack.length > 0) {
        addNode("", "bubble","temp");
    }

    //0-N ORDER STACK
    for (m = 0; m < orderStack.length - 1; m++) {
        switch (orderStack[m]) {
            case START:
                if (!typeStack[nodeindex]) {
                    typeStack[nodeindex] = nodetypes[typeindex];
                }
                break;
            case NODE:
                addNode(newnodes[nodeindex], typeStack[nodeindex], typesetter);
                if (!starGraph) {
                    addLink(newnodes[nodeindex - 1], newnodes[nodeindex],
                            newlinks[linkindex], typesetter);
                }
                nodeindex++;
                break;
            case LINK:
                linkindex++;
                break;
        }
    }

    //FINAL N ORDER
    switch (orderStack[orderStack.length - 1]) {
        case START:
            typeStack[nodeindex]=nodetypes[typeindex];
            addNode("new node", typeStack[nodeindex], "temp");
            if (!starGraph) {
                addLink(newnodes[nodeindex - 1], "new node", newlinks[linkindex], "temp");
                and_connect("new node");
            }
            ret.state = ANALYSIS_NODE_START;
            break;
        case NODE:
            typeStack[nodeindex]=nodetypes[typeindex];
            addNode(newnodes[nodeindex], typeStack[nodeindex], typesetter);
            if (!starGraph) {
                addLink(newnodes[nodeindex - 1], newnodes[nodeindex], newlinks[linkindex], typesetter);
                and_connect(newnodes[nodeindex]);
            }
            break;
        case LINK:
            linkindex++;
            addNode("new node", "empty", "temp");
            if (!starGraph) {
                addLink(newnodes[nodeindex - 1], "new node", newlinks[linkindex], "temp");
                and_connect("new node");
            }
            ret.state = ANALYSIS_LINK;
            break;
    }

    //EXTERNAL AND CONNECTION CHECKING
    function and_connect(node) {
        var verb;
        for(var x=0;x<newlinks.length;x++){
            if(newlinks[x])if(newlinks[x].replace(/ /g,"")!=="and"){
                verb = newlinks[x];
                for(var y=0; y<x ;y++){
                    addLink(newnodes[y], node, verb, typesetter);
                    for(var z=x; z<newnodes.length ;z++){
                        addLink(newnodes[y], newnodes[z], verb, typesetter);
                    }
                }
            }
        }
    }

    /*console.log(sentence);
    console.log(completeSentence);
    console.log(orderStack);*/

    //STAR CASE
    if (starGraph) {
        addNode(completeSentence, "chainlink", typesetter);
        for (n = 0; n < newnodes.length; n++) {
            addLink(newnodes[n], completeSentence, "", typesetter);
        }
    }

    ret.drop_conjugator_links = and_count < linkindex;

    ret.applyToGraph = function(graph, backend_commit) {
        window.ret = ret;
        var comp = graph.compareSubset('temp',
            ret.nodes.filter(
                function(node) {
                    return !graph.hasNodeByName(node.name, "perm")
                        && node.type !== 'bubble';
                }).map(function (node) {
                    return {name: node.name};
                }),
            ret.links.map(
                function (link) {
                    return [link.sourceName, link.targetName];
                }));

        var k, n, l;
        if (comp.graph_same && !finalize) {
            if (comp.old_name && comp.new_name) {
                up_to_two_renames(graph, comp.old_name, comp.new_name);
            }
            for (k in ret.links) {
                l = ret.links[k];
                graph.addLinkByName(l.sourceName, l.targetName, l.name, l.state, ret.drop_conjugator_links);
            }
        } else {
            // REINITIALISE GRAPH (DUMB BUT IT WORKS)
            graph.removeNodes("temp");
            graph.removeLinks("temp");
            for (k in ret.nodes) {
                n = ret.nodes[k];
                if (n.state == 'temp' && finalize) {
                    console.log('bug: temp node creation on finalize');
                } else {
                    lastnode = graph.addNode(n.name, n.type, n.state);
                }
            }
            for (k in ret.links) {
                l = ret.links[k];
                if (!finalize || l.name !== 'and') {
                    graph.addLinkByName(l.sourceName, l.targetName, l.name, l.state, ret.drop_conjugator_links);
                }
            }
        }

        if (finalize && backend_commit) {
            // broadcast diff:
            //    - finalize?
            //    - broadcast_diff requested by caller
            var topo_diff = model_util.adapt_format_write_topo_diff(ret.nodes, ret.links);
            var diff_set = model_diff.new_diff_set();
            diff_set.add_diff_obj(topo_diff);
            graph.commit_diff_set(diff_set);
        }

        // UPDATE GRAPH ONCE
        graph.update(!finalize && comp.graph_same);
    };

    if (finalize) {
        typeStack = [];
    }

    return ret;
};

return {
    autocompleteCallback:autocompleteCallback,
    textAnalyser:textAnalyser,
    autoSuggestAddName:autoSuggestAddName,
    ANALYSIS_NODE_START:ANALYSIS_NODE_START,
    ANALYSIS_LINK:ANALYSIS_LINK,

    //for the external arrow-type changer
    lastnode: function() { return lastnode; },

    typeindex: function() { return typeindex; },
    typeindex_next: function() {
        typeindex = (typeindex + 1) % 5;
        return typeindex;
    },
    typeindex_prev: function() {
        typeindex = (typeindex + 4) % 5;
        return typeindex;
    },
    nodetypes: function() { return nodetypes; } // XXX should be readonly, but returning a copy?
};
});
