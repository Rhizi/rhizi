"use strict";

define(['rz_core', 'model/core', 'model/util', 'model/diff', 'rz_bus', 'consts'],
function(rz_core,   model_core,   model_util,   model_diff,   rz_bus,   consts) {

var typeindex = 0;
var nodetypes = ["person", "club", "skill", "interest", "third-internship-proposal", "internship"];
var typeStack = [];

var lastnode;

var sugg = {}; // suggestions for autocompletion of node names

var ANALYSIS_NODE_START = 'ANALYSIS_NODE_START';
var ANALYSIS_NODE = 'ANALYSIS_NODE'
var ANALYSIS_LINK = 'ANALYSIS_LINK';

function selectedType()
{
    return nodetypes[typeindex];
}

function autoSuggestAddName(name)
{
    /* note that name can contain spaces - this is ok. We might want to limit this though? */
    sugg[name] = 1;
}

function unquoted(name)
{
    var start = 0,
        end = name.length;

    if (name.length >= 1) {
        if (name.charAt(0) == '"') {
            start = 1;
            if (name.length > 1 && name.charAt(name.length - 1) == '"') {
                end = name.length - 1;
            }
        }
        return name.substring(start, end);
    }
    return name;
}

function autocompleteCallback(request, response_callback)
{
    var ret = [];
    if (request.term === "" || request.term) {
        for (var name in sugg) {
            if (name.toLowerCase().indexOf(unquoted(request.term.toLowerCase())) === 0) {
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
 *  so much for more complex sentences involving more than two nodes (two '#'
 *  marks).
 *
 */
var textAnalyser = function (newtext, finalize) {
    var sentence,
        token_set_new_node_names = [], // token set representing new node names
        token_set_new_link_names = [], // token set representing new link names
        linkindex = 0,
        nodeindex = 0,
        orderStack = [],
        and_count = 0,
        prefix = "",
        m,
        word,
        completeSentence,
        typesetter, starGraph,
        n,
        link_hash = {},
        yell_bug = false, // TODO: fix both issues
        NODE = "NODE",
        LINK = "LINK",
        START = "START",
        ret = model_diff.new_topo_diff();

    function addNode(name, type, state) {
        if (type === undefined) {
            console.log('bug: textanalyser.addNode of type undefined');
        }
        var node = model_core.create_node__with_optional_id(
                {'name':name,
                 'type':type,
                 'state':state});

        ret.node_set_add.push(node);
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

        var link = model_core.create_link_from_spec(src, dst, {'name':name, 'state':state});
        ret.link_set_add.push(link);
    }

    if (newtext.indexOf('#') == -1 || finalize) {
        lastnode = null;
    }

    //Sentence Sequencing
    //Build the words and cuts the main elements
    sentence = tokenize(newtext, '#', '"');

    // build new node,link arrays in order of appearance
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
                token_set_new_node_names.push(sentence[m]);
                linkindex++;
            } else if (orderStack[orderStack.length - 1] === NODE) {
                orderStack.push(LINK);
                if (!token_set_new_link_names[linkindex]) {
                    token_set_new_link_names[linkindex] = sentence[m] + " ";
                } else {
                    token_set_new_link_names[linkindex] += sentence[m] + " ";
                }
            } else {
                if (!token_set_new_link_names[linkindex]) {
                    token_set_new_link_names[linkindex] = sentence[m] + " ";
                } else {
                    token_set_new_link_names[linkindex] += sentence[m] + " ";
                }
            }
            if (token_set_new_node_names.length === 0) {
                prefix += (prefix.length > 0 ? ' ' : '') + sentence[m];
            }
            break;
        }
    }

    starGraph = (token_set_new_link_names.length - and_count) >= 3  ||
        ((token_set_new_link_names.length - and_count >= 1) &&
         token_set_new_link_names.length > 2 &&
         orderStack.length > 1 &&
         orderStack[orderStack.length - 1] != NODE);

    //PREFIX not null case - put complete sentence in first link.
    if (prefix && !starGraph) {
        token_set_new_link_names[1] = prefix + " " + token_set_new_node_names[0] +
        (token_set_new_link_names[1] !== undefined || token_set_new_node_names[1] !== undefined ?
        " " : "")
        + (token_set_new_link_names[1] !== undefined ? token_set_new_link_names[1] : "")
        + (token_set_new_node_names[1] !== undefined ? token_set_new_node_names[1] : "");
    }

    //WRITE COMPLETE SENTENCE
    linkindex = 0;
    nodeindex = 0;
    word = "";
    completeSentence = prefix.length > 0 ? String(prefix) + " " : "";
    for (m = 0; m < orderStack.length; m++) {
        if (orderStack[m] === NODE) {
            word += " (" + token_set_new_node_names[nodeindex] + ") ";
            completeSentence += token_set_new_node_names[nodeindex] + " ";
            nodeindex++;
        } else if (orderStack[m] === LINK) {
            word += " -->" + token_set_new_link_names[nodeindex] + " --> ";
            completeSentence += token_set_new_link_names[nodeindex];
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
        for (n = 0; n < token_set_new_node_names.length; n++) {
            autoSuggestAddName(token_set_new_node_names[n]);
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
                    typeStack[nodeindex] = selectedType();
                }
                break;
            case NODE:
                addNode(token_set_new_node_names[nodeindex], typeStack[nodeindex], typesetter);
                if (!starGraph && nodeindex > 0) {
                    addLink(token_set_new_node_names[nodeindex - 1],
                            token_set_new_node_names[nodeindex],
                            token_set_new_link_names[linkindex], typesetter);
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
            typeStack[nodeindex] = selectedType();
            addNode("new node", typeStack[nodeindex], "temp");
            if (!starGraph && nodeindex > 0) {
                addLink(token_set_new_node_names[nodeindex - 1], "new node",
                        token_set_new_link_names[linkindex], "temp");
                and_connect("new node");
            }
            ret.state = ANALYSIS_NODE_START;
            break;
        case NODE:
            typeStack[nodeindex] = selectedType();
            addNode(token_set_new_node_names[nodeindex], typeStack[nodeindex], typesetter);
            if (!starGraph && nodeindex > 0) {
                addLink(token_set_new_node_names[nodeindex - 1],
                        token_set_new_node_names[nodeindex],
                        token_set_new_link_names[linkindex], typesetter);
                and_connect(token_set_new_node_names[nodeindex]);
            }
            ret.state = ANALYSIS_NODE_START;
            break;
        case LINK:
            linkindex++;
            addNode("new node", selectedType(), "temp");
            if (!starGraph) {
                addLink(token_set_new_node_names[nodeindex - 1], "new node", token_set_new_link_names[linkindex], "temp");
                and_connect("new node");
            }
            ret.state = ANALYSIS_LINK;
            break;
    }

    //EXTERNAL AND CONNECTION CHECKING
    function and_connect(node) {
        var verb;
        for(var x=0;x<token_set_new_link_names.length;x++){
            if(token_set_new_link_names[x])if(token_set_new_link_names[x].replace(/ /g,"")!=="and"){
                verb = token_set_new_link_names[x];
                for(var y=0; y<x ;y++){
                    addLink(token_set_new_node_names[y], node, verb, typesetter);
                    for(var z=x; z<token_set_new_node_names.length ;z++){
                        addLink(token_set_new_node_names[y], token_set_new_node_names[z], verb, typesetter);
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
        for (n = 0; n < token_set_new_node_names.length; n++) {
            addLink(token_set_new_node_names[n], completeSentence, "", typesetter);
        }
    }

    ret.drop_conjugator_links = and_count < linkindex;

    ret.applyToGraph = function(graph, backend_commit) {
        window.ret = ret;

        /*
         * generate fitered node set who:
         * - are not name-present in graph
         * - are not of type 'bubble'
         */
        var n_set = ret.node_set_add.filter(function(node) {
                    return false == graph.hasNodeByName(node.name, "perm")
                        && node.type !== 'bubble';
                });

        var comp = graph.compareSubset('temp', n_set, ret.link_set_add);

        if (false == finalize && comp.graph_same) {
            if (comp.old_name && comp.new_name) {
                up_to_two_renames(graph, comp.old_name, comp.new_name);
            }

            ret.for_each_link_add(function (link) {
                graph.addLinkByName(link.__src.name,
                                    link.__dst.name,
                                    link.name,
                                    link.state,
                                    ret.drop_conjugator_links);
            });
        } else {
            // REINITIALISE GRAPH (DUMB BUT IT WORKS)
            graph.removeNodes("temp");
            graph.removeLinks("temp");

            ret.for_each_node_add(function (node) {
                if (true == finalize && node.state == 'temp') {
                    console.log('bug: temp node creation on finalize');
                } else {
                    if (!finalize) {
                        lastnode = graph.addNode(node);
                    } else {
                        graph.addNode(node);
                    }
                }
            });

            ret.for_each_link_add(function (link) {
                if (false == finalize || link.name !== 'and') {
                    graph.addLinkByName(link.__src,
                                        link.__dst,
                                        link.name,
                                        link.state,
                                        ret.drop_conjugator_links);
                }
            });
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
        rz_core.update_view__graph(!finalize && comp.graph_same);
    };

    if (finalize) {
        typeStack = [];
    }

    return ret;
};

function init(graph)
{
    function onNodeAdded(diff) {
        if (!diff || !diff.nodes || !diff.nodes.added) {
            return;
        }
        for (var k in diff.nodes.added) {
            var node = diff.nodes[k];
            autoSuggestAddName(node.name.toLowerCase());
        }
    }
    function toLowerCase(n) {
        return n.toLowerCase();
    }
    function onSuggestedNameAdd(names) {
        names.map(toLowerCase).forEach(autoSuggestAddName);
    }
    graph.diffBus.onValue(onNodeAdded);
    rz_bus.names.onValue(onSuggestedNameAdd);
}

return {
    init:init,
    autocompleteCallback:autocompleteCallback,
    textAnalyser:textAnalyser,
    autoSuggestAddName:autoSuggestAddName,
    ANALYSIS_NODE_START:ANALYSIS_NODE_START,
    ANALYSIS_NODE: ANALYSIS_NODE,
    ANALYSIS_LINK:ANALYSIS_LINK,

    //for the external arrow-type changer
    lastnode: function() { return lastnode; },

    selected_type_next: function() {
        typeindex = (typeindex + 1) % 5;
        return selectedType();
    },
    selected_type_prev: function() {
        typeindex = (typeindex + 4) % 5;
        return selectedType();
    }
};
});
