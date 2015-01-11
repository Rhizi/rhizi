"use strict";

define(['rz_core', 'model/core', 'model/util', 'model/diff', 'consts', 'util'],
function(rz_core,   model_core,   model_util,   model_diff,   consts,   util) {

var typeindex = 0,
    nodetypes = consts.nodetypes,
    node_name_to_type = {};

var _get_lastnode,
    get_lastnode = function (editgraph, cursor) { return _get_lastnode(editgraph, cursor); };

var sugg_name = {},
    id_to_name_map = {},
    suggestions_bus = new Bacon.Bus(),
    suggestions_options = suggestions_bus.toProperty();

suggestions_bus.push([]);

var ANALYSIS_NODE_START = 'ANALYSIS_NODE_START';
var ANALYSIS_NODE = 'ANALYSIS_NODE'
var ANALYSIS_LINK = 'ANALYSIS_LINK';

function selectedType()
{
    return nodetypes[typeindex];
}

/**
 * Tokenizer for input.
 *
 * node_token is it's own token, represented by itself.
 *
 * accepts a quotation char which allows whitespace in between.
 *
 * treats '\\' as a quote for the next char.
 *
 * TODO:  should only apply if cursor is actually on token,
 *
 * so need tokenise to be fixed to split according to actual tokens,
 * i.e.:
 * #"one two" four five #six
 * is exactly 3 tokens:
 * #"one two"
 * four five
 * #six
 * or 5 if you assign a token for the '#' char:
 * #
 * "one two"
 * four five
 * #
 * six
 */
function tokenize(text, node_token, quote)
{
    var c,
        i,
        tokens = [],
        token = [],
        inquote = false,
        prev = null,
        prev_whitespace = true,
        start = 0,
        next = function() {
            if (token.length > 0) {
                tokens.push({start: start, end: i, token: token.join('')});
                token = [];
                start = i;
            }
        };
    for (i = 0 ; i < text.length; ++i) {
        c = text[i];
        if (prev == '\\') {
            token.push(c);
            prev = null;
            continue;
        }
        switch (c) {
        case ' ':
        case '\t':
            if (inquote) {
                token.push(c);
            } else {
                next();
            }
            break;
        case quote:
            inquote = !inquote;
            token.push(c);
            break;
        default:
            if (c == node_token && prev_whitespace) {
                tokens.push({start: i, end: i + 1, token: node_token});
                start = i + 1;
            } else {
                token.push(c);
            }
        }
        prev = c;
        prev_whitespace = prev === null || prev === ' ' || prev === '\t';
    }
    next();
    return tokens;
}


/*
 * id - undefined | node id 
 *
 */
function auto_suggest__update_name(name, id)
{
    if (id !== undefined && id_to_name_map[id] !== undefined) {
        delete sugg_name[id_to_name_map[id]];
        id_to_name_map[id] = name;
    }
    /* note that name can contain spaces - this is ok. We might want to limit this though? */
    sugg_name[name] = 1;
    suggestions_bus.push(sugg_name);
}

function auto_suggest_remove_name(name, id)
{
    if (name !== undefined) {
        delete sugg_name[name];
    }
    if (id !== undefined) {
        delete sugg_name[id_to_name_map[id]];
        delete id_to_name_map[id];
    }
    suggestions_bus.push(sugg_name);
}

function auto_suggest__update_from_graph()
{
    sugg_name = {};
    id_to_name_map = {};
    rz_core.main_graph.nodes().forEach(function (node) {
        auto_suggest__update_name(node.name.toLowerCase(), node.id);
    });
    suggestions_bus.push(sugg_name);
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
var textAnalyser = function (spec) {
    var newtext = spec.sentence,
        finalize = spec.finalize,
        cursor = spec.cursor,

        tokens,
        sentence,
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
        completeSentenceParts,
        starGraph,
        n,
        link_hash = {},
        yell_bug = false, // TODO: fix both issues
        NODE = "NODE",
        LINK = "LINK",
        START = "START",
        node_by_name = {},
        nodes = [],
        links = [],
        ret = model_diff.new_topo_diff();

    util.assert(spec.sentence !== undefined &&
                spec.finalize !== undefined &&
                spec.cursor !== undefined,
                "bad input");

    function __addNode(name) {
        var node = {
                    'name': name,
                    'type': node_name_to_type[name] || selectedType(),
                   };
        nodes.push(node);
    }

    function __addLink(src_name, dst_name, name) {
        if (!src_name || !dst_name) {
            if (yell_bug) {
                console.log('bug - adding link (' + src_name + ', ' + dst_name + ')');
            }
            return;
        }
        name = name || 'is';
        if (link_hash[src_name] && link_hash[src_name][dst_name]) {
            if (yell_bug) {
                console.log('bug - adding link twice (' + src_name + ', ' + dst_name + ')');
            }
            return;
        }
        if (!link_hash[src_name]) {
            link_hash[src_name] = {};
        }
        link_hash[src_name][dst_name] = 1;

        var link = {
            src_name: src_name,
            dst_name: dst_name,
            name: name,
        };
        links.push(link);
    }

    //Sentence Sequencing
    //Build the words and cuts the main elements
    tokens = tokenize(newtext, '#', '"');
    sentence = tokens.map(function (d) { return d.token; });

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
                    token_set_new_link_names[linkindex] = sentence[m];
                } else {
                    token_set_new_link_names[linkindex] += " " + sentence[m];
                }
            } else {
                if (!token_set_new_link_names[linkindex]) {
                    token_set_new_link_names[linkindex] = sentence[m];
                } else {
                    token_set_new_link_names[linkindex] += " " + sentence[m];
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
    completeSentenceParts = prefix.length > 0 ? [String(prefix)] : [];
    for (m = 0; m < orderStack.length; m++) {
        if (orderStack[m] === NODE) {
            word += " (" + token_set_new_node_names[nodeindex] + ") ";
            completeSentenceParts.push(token_set_new_node_names[nodeindex]);
            nodeindex++;
        } else if (orderStack[m] === LINK) {
            word += " -->" + token_set_new_link_names[nodeindex] + " --> ";
            completeSentenceParts.push(token_set_new_link_names[nodeindex]);
        }
    }
    completeSentence = completeSentenceParts.join(" ").trim();

    //REBUILD GRAPH
    linkindex = 0;
    nodeindex = 0;

    //0-N ORDER STACK
    for (m = 0; m < orderStack.length - 1; m++) {
        switch (orderStack[m]) {
            case START:
                break;
            case NODE:
                __addNode(token_set_new_node_names[nodeindex]);
                if (!starGraph && nodeindex > 0 && token_set_new_link_names[linkindex] !== undefined) {
                    __addLink(token_set_new_node_names[nodeindex - 1],
                              token_set_new_node_names[nodeindex],
                              token_set_new_link_names[linkindex]);
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
            __addNode("new node");
            if (!starGraph && nodeindex > 0) {
                __addLink(token_set_new_node_names[nodeindex - 1], "new node",
                          token_set_new_link_names[linkindex], "temp");
                and_connect("new node");
            }
            ret.state = ANALYSIS_NODE_START;
            break;
        case NODE:
            __addNode(token_set_new_node_names[nodeindex]);
            if (!starGraph && nodeindex > 0 && token_set_new_link_names[linkindex] !== undefined) {
                __addLink(token_set_new_node_names[nodeindex - 1],
                          token_set_new_node_names[nodeindex],
                          token_set_new_link_names[linkindex]);
                and_connect(token_set_new_node_names[nodeindex]);
            }
            ret.state = ANALYSIS_NODE_START;
            break;
        case LINK:
            linkindex++;
            __addNode("new node", selectedType(), "temp");
            if (!starGraph) {
                __addLink(token_set_new_node_names[nodeindex - 1], "new node", token_set_new_link_names[linkindex], "temp");
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
                    __addLink(token_set_new_node_names[y], node, verb);
                    for(var z=x; z<token_set_new_node_names.length ;z++){
                        __addLink(token_set_new_node_names[y],
                                  token_set_new_node_names[z], verb);
                    }
                }
            }
        }
    }

    //STAR CASE
    if (starGraph) {
        __addNode(completeSentence, "chainlink");
        for (n = 0; n < token_set_new_node_names.length; n++) {
            __addLink(token_set_new_node_names[n], completeSentence, "chained");
        }
    }

    ret.drop_conjugator_links = and_count < linkindex;

    ret.applyToGraph = function(spec) {
        var edit_graph = spec.edit_graph,
            backend_commit = spec.backend_commit,
            main_graph = edit_graph.base;

        util.assert(edit_graph !== undefined &&
                    main_graph !== undefined &&
                    backend_commit !== undefined, "missing inputs");
        window.ret = ret;

        ret.node_set_add = nodes.map(function (node) {
            var main_node = main_graph.find_node__by_name(node.name);
            if (main_node) {
                console.log('!!! returning a node from the parent graph');
                return main_node;
            }
            return model_core.create_node__set_random_id(node);
        });
        // fill in hash to be used for link creation
        ret.node_set_add.forEach(function (node) {
            node_by_name[node.name] = node;
        });

        ret.link_set_add = links
            .filter(function (link) {
                return !finalize ||
                       !ret.drop_conjugator_links ||
                       (link.name.replace(/ /g,"") !== "and");
                })
            .map(function (link_spec) {
                var src = node_by_name[link_spec.src_name],
                    dst = node_by_name[link_spec.dst_name],
                    link = model_core.create_link__set_random_id(src, dst, {
                        name: link_spec.name,
                        state: 'perm', // FIXME: this is meaningless now with graph separation
                    });
                link.__src_id = src.id;
                link.__dst_id = dst.id;
                return link;
            });

        // REINITIALISE GRAPH (DUMB BUT IT WORKS)
        /* don't push diff, avoid bubble on main_graph going to zero */
        edit_graph.clear(finalize);

        if (!finalize) {
            main_graph.markRelated(token_set_new_node_names);
        } else {
            main_graph.removeRelated();
        }

        if (finalize && backend_commit) {
            main_graph.commit_and_tx_diff__topo(ret);
        } else {
            edit_graph.commit_diff__topo(ret);
        }
    };

    function lookup_node_in_bounds(edit_graph) {
        var i, d, j, name, node;

        // go forward to find cursor location in tokens
        for (i = 0 ; i < tokens.length; ++i) {
            d = tokens[i];
            if (cursor >= d.start && cursor < d.end) {
                break;
            }
        }
        // go back to find token
        for (j = i - 1; j >= 0 && tokens[j].token != '#'; --j) {}
        name = tokens[j + 1] ? tokens[j + 1].token : 'new node';
        node = edit_graph.find_node__by_name(name);
        util.assert(node !== undefined, "can't find node");
        return node;
    }

    _get_lastnode = finalize || tokens.length == 0 ? function () { return null }
                                                  : lookup_node_in_bounds;

    return ret;
};

function init(main_graph)
{
    main_graph.diffBus
        .onValue(auto_suggest__update_from_graph);
}

return {
    init:init,
    textAnalyser:textAnalyser,
    suggestions_options: suggestions_options,
    ANALYSIS_NODE_START:ANALYSIS_NODE_START,
    ANALYSIS_NODE: ANALYSIS_NODE,
    ANALYSIS_LINK:ANALYSIS_LINK,

    //for the external arrow-type changer
    lastnode: get_lastnode,
    set_type: function(name, nodetype) {
        node_name_to_type[name] = nodetype;
    },

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
