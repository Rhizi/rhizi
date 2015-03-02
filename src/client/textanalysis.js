define(['rz_core', 'model/core', 'model/util', 'model/diff', 'consts', 'util'],
function(rz_core,   model_core,   model_util,   model_diff,   consts,   util) {
"use strict";

// Aliases
var reduce = util.reduce;

// Constants
var node_edge_separator = rz_config.node_edge_separator;
var separator_string = rz_config.separator_string;

var typeindex = 0,
    nodetypes = consts.nodetypes,
    node_name_to_type = {};

var _get_lastnode,
    get_lastnode = function (editgraph, cursor) {
        return undefined !== _get_lastnode ? _get_lastnode(editgraph, cursor) : null;
    };

var sugg_name = {},
    id_to_name_map = {},
    suggestions_bus = new Bacon.Bus(),
    suggestions_options = suggestions_bus.toProperty();

suggestions_bus.push([]);

var ANALYSIS_NODE_START = 'ANALYSIS_NODE_START';
var ANALYSIS_NODE = 'ANALYSIS_NODE';
var ANALYSIS_LINK = 'ANALYSIS_LINK';

var NEW_NODE_NAME = consts.NEW_NODE_NAME;

function selectedType()
{
    return nodetypes[typeindex];
}

function mod_2_second(mod)
{
    return function(_, i) { return i % 2 === mod; };
}

function even_second(_, i)
{
    return i % 2 === 0;
}

function list_first_pred(list, default_, pred)
{
    for (var i = 0 ; i < list.length ; ++i) {
        if (pred(list[i])) {
            return list[i];
        }
    }
    return default_;
}

function list_product(l1, l2)
{
    var ret = [],
        i, j;
    for (i = 0 ; i < l1.length ; ++i) {
        for (j = 0; j < l2.length ; ++j) {
            ret.push([l1[i], l2[j]]);
        }
    }
    return ret;
}

function subsets(N, jump, list)
{
    var ret = [],
        i;
    for (i = 0 ; i < list.length ; i += jump) {
        ret.push(list.slice(i, i + N));
    }
    return ret;
}

function subsets_strict(N, jump, list)
{
    return subsets(N, jump, list).filter(function (data) { return data.length === N; });
}

function group(list, predicate)
{
    if (list.length === 0) {
        return [];
    }
    var ret = [[list[0]]],
        i,
        last = predicate(list[0], 0),
        new_pred;

    for (i = 1 ; i < list.length ; ++i) {
        new_pred = predicate(list[i], i);
        if (new_pred === last) {
            ret[ret.length - 1].push(list[i]);
        } else {
            ret.push([list[i]]);
            last = new_pred;
        }
    }
    return ret;
}

function list_get(list, index, def)
{
    var item = list[index];

    if (item === undefined) {
        return def;
    }
    return item;
}

var obj_take = util.obj_take;

function list_length_larger(n) {
    return function(list) {
        return list.length > n;
    }
}

function obj_field_not_equal(field, value) {
    return function(obj) {
        return obj[field] != value;
    }
}

/**
 *
 * tokens_to_graph_elements_*
 *
 * @param tokens: [token]
 * @ret [prefix, node, edge, node, edge, ..]
 * where
 *  node, edge = {start: int, end: int, tokens: [token]}
 */
function tokens_to_graph_elements_with_separator(tokens) {
    return reduce(tokens, [[] /* no prefix */, []], function (data, token) {
        if (token.token === separator_string) {
            data.push([]);
        } else {
            data[data.length - 1].push(token);
        }
        return data;
    });
}

function tokens_to_graph_elements_with_node_sign(tokens) {
    var ret = [[]]; // prefix is the first element
    for (var i = 0 ; i < tokens.length;) {
        if (tokens[i].token === separator_string) {
            if (tokens.length == i + 1) {
                tokens.push({end: tokens[i].end + 1 + NEW_NODE_NAME.length,
                             token: NEW_NODE_NAME});
            }
            tokens[i + 1].start = tokens[i].start; // used later for finding node from cursor position
            ret.push([tokens[i + 1]]);
            ret.push([]);
            i += 2;
        } else {
            ret[ret.length - 1].push(tokens[i]);
            i += 1;
        }
    }
    // remove last empty element if not just prefix - can only be a non empty link or a non empty node
    return ret.length > 1 && ret[ret.length - 1].length === 0 ? ret.slice(0, ret.length - 1) : ret;
}

var tokens_to_graph_elements;

if (node_edge_separator) {
    tokens_to_graph_elements = tokens_to_graph_elements_with_separator;
} else {
    tokens_to_graph_elements = tokens_to_graph_elements_with_node_sign;
}

function groups_to_thirds(groups) {
    return groups.filter(list_length_larger(0)).map(function(tokens) {
        var start = tokens[0].start,
            end = tokens[tokens.length - 1].end;
        return {
            start: start,
            end: end,
            token: tokens.map(obj_take('token')).join(' ')
        };
    });
}

/*
 * Place to do general cleanup of the text. Right now just replacing all quotation types
 * with a single type, separately for double quotes and single quotes.
 */
function cleanup(text)
{
    return text
        .replace(/[״”“„‟″‶]/, '"')   // Convert typographic double quotes
        .replace(/[`׳’‘‚‛′‵]/, "'"); // Convert typographic single quotes
}

/**
 * Tokenizer for input.
 *
 * Assumes the whole input string is available, used for lookahead via slice.
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
        is_node_token,
        next = function() {
            if (token.length > 0) {
                tokens.push({start: start, end: i, token: token.join('')});
                token = [];
                start = i;
            }
        };
    for (i = 0 ; i < text.length;) {
        c = text[i];
        is_node_token = text.slice(i, i + node_token.length) === node_token;
        if (prev === '\\') {
            token.push(c);
            prev = null;
            continue;
        }
        if (is_node_token && (node_token.length > 1 || prev_whitespace)) {
            next();
            tokens.push({start: i, end: i + node_token.length, token: node_token});
            start = i + node_token.length;
            i += node_token.length;
        } else {
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
                break;
            default:
                token.push(c);
            }
            i += 1;
        }
        prev = c;
        prev_whitespace = prev === null || prev === ' ' || prev === '\t';
    }
    next();
    // Remove whitespace around tokens. Can be done with lookahead but less code this way
    tokens.filter(obj_field_not_equal('token', node_token))
          .forEach(function (obj) { obj.token = obj.token.trim(); });
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

function auto_suggest__update_from_graph()
{
    sugg_name = {};
    id_to_name_map = {};
    rz_core.main_graph.nodes().forEach(function (node) {
        auto_suggest__update_name(node.name, node.id);
    });
    suggestions_bus.push(sugg_name);
}

function lowerCaseHash() {
    var hash = {};
    hash.set = function (name, value) {
        hash[name.toLowerCase()] = value;
    };
    hash.get = function (name) {
        return hash[name.toLowerCase()];
    };
    return hash;
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

        tokens,
        groups,
        thirds,
        node_thirds,
        sentence,
        node_names, // token set representing new node names
        link_names, // token set representing new link names
        linkindex = 0,
        nodeindex = 0,
        and_count = 0,
        prefix,
        completeSentence,
        link_hash = {},
        yell_bug = false, // TODO: fix both issues
        node_by_name = lowerCaseHash(),
        nodes = [],
        links = [],
        ret = model_diff.new_topo_diff();

    util.assert(spec.sentence !== undefined &&
                spec.finalize !== undefined &&
                "bad input");

    function __addNode(name) {
        var type;
        if (name === NEW_NODE_NAME) {
            type = selectedType();
        } else {
            type = node_name_to_type[name] || nodetypes[0];
        }
        var node = {
                    'name': name,
                    'type': type,
                   };
        node_name_to_type[name] = type;
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
    tokens = tokenize(cleanup(newtext), separator_string, '"');
    tokens.forEach(function (token) {
        switch (token.token) {
        case "and":
        case "+":
        case ",":
        case "&":
            and_count++;
            token.token = "and";
        }
    });
    groups = tokens_to_graph_elements(tokens); // [prefix, node, verb, node, verb, ..]
    prefix = groups[0].map(obj_take('token')).join(' ');
    thirds = groups_to_thirds(groups.slice(1)); // [node, verb, node, verb, ..]
    sentence = thirds.map(obj_take('token'));
    var sentence_ends_with_link = (thirds.length > 0 && thirds.length % 2 === 0);

    // build new node,link arrays in order of appearance
    var mod_2 = function (mod) {
        return thirds.filter(mod_2_second(mod)).map(obj_take('token'));
    };
    node_names = mod_2(0);
    if (node_names[node_names.length - 1] === '') {
        node_names[node_names.length - 1] = NEW_NODE_NAME;
    }
    link_names = mod_2(1);

    //WRITE COMPLETE SENTENCE
    linkindex = 0;
    nodeindex = 0;
    completeSentence = (prefix.length > 0 ? [String(prefix)] : []).concat(thirds.map(obj_take('token')))
        .join(" ").trim();

    //PREFIX not null case - put complete sentence in first link.
    if (prefix.length > 0 && link_names.length > 0) {
        link_names[0] = completeSentence;
    }

    //REBUILD GRAPH
    if (sentence_ends_with_link) {
        __addNode(NEW_NODE_NAME);
    }
    node_names.forEach(function (node_name, nodeindex) {
        var link_name = link_names[nodeindex],
            next_node_name = list_get(node_names, nodeindex + 1, NEW_NODE_NAME);
        __addNode(node_name);
        if (link_name !== undefined) {
            __addLink(node_name,
                      next_node_name,
                      link_name);
        }
    });

    ret.state = sentence_ends_with_link ? ANALYSIS_LINK : ANALYSIS_NODE_START;
    // A and B verb C => link_with_verb_to([A, B], C)
    // A and B verb C and D verb2 E =>
    //  [A, B] verb [C, D]
    //  [C, D] verb2 E
    //  A, and, B, verb, C, and, D, verb2, E
    //  [A, and, B], [verb], [C, and, D], [verb2], [E]
    //  # ==> "new node"
    var node_or_and = function (obj, i) { return i % 2 === 0 || obj.token === 'and'; };
    function and_connect() {
        subsets_strict(3, 2, group(thirds, node_or_and))
            .forEach(function (data) {
                var and_source = data[0].filter(even_second).map(obj_take('token')),
                    and_target = data[2].filter(even_second).map(obj_take('token')),
                    verb = data[1][0].token;
                util.assert(data[1].length == 1);
                list_product(and_source, and_target).forEach(function (pair) {
                    __addLink(pair[0], pair[1], verb);
                });
            });
    }
    and_connect();

    ret.drop_conjugator_links = true; // leaving since we might change behavior again

    // textanalysis.ui uses this. should make this more explicit
    ret.thirds = thirds;

    ret.existing_nodes = function (main_graph) {
        function not_null(x) { return x !== null; };
        return nodes.map(obj_take('name')).map(main_graph.find_node__by_name).filter(not_null);
    }

    ret.applyToGraph = function(spec) {
        var edit_graph = spec.edit_graph,
            backend_commit = spec.backend_commit,
            main_graph = edit_graph.base,
            existing_nodes = [];

        util.assert(edit_graph !== undefined &&
                    main_graph !== undefined &&
                    backend_commit !== undefined, "missing inputs");
        window.ret = ret;

        ret.node_set_add = nodes
            .filter(function (node_spec) {
                var main_node = main_graph.find_node__by_name(node_spec.name);
                if (main_node) {
                    existing_nodes.push(main_node);
                }
                return main_node === null;
            })
            .map(function (node_spec) {
                return model_core.create_node__set_random_id(node_spec);
            });
        // fill in hash to be used for link creation, new and existing nodes
        ret.node_set_add.forEach(function (node) {
            node_by_name.set(node.name, node);
        });
        existing_nodes.forEach(function (node) {
            node_by_name.set(node.name, node);
        });

        ret.link_set_add = links
            .filter(function (link) {
                return !finalize ||
                       !ret.drop_conjugator_links ||
                       (link.name.replace(/ /g,"") !== "and");
                })
            .map(function (link_spec) {
                var src = node_by_name.get(link_spec.src_name),
                    dst = node_by_name.get(link_spec.dst_name),
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
            main_graph.markRelated(node_names);
        } else {
            main_graph.removeRelated();
        }

        if (finalize && backend_commit) {
            main_graph.commit_and_tx_diff__topo(ret);
        } else {
            edit_graph.commit_diff__topo(ret);
        }
    };

    node_thirds = subsets(3, 2, thirds).map(function (list) {
        var first = list[0],
            end = list.length > 2 ? list[list.length - 1].start - 1 : list[list.length - 1].end;
        return {start: first.start, end: end, token: first.token};
    });

    function lookup_node_in_bounds(edit_graph, cursor) {
        var d, name, node;

        if (nodes.length <= 0) {
            return null;
        }
        if (nodes.length === 1) {
            return edit_graph.find_node__by_name(nodes[0].name);
        }
        d = list_first_pred(node_thirds, thirds[thirds.length - 1], function (d) {
            return cursor >= d.start && cursor < d.end;
        });
        name = d.token;
        node = edit_graph.find_node__by_name(name);
        util.assert(node !== undefined, "can't find node");
        return node;
    }

    _get_lastnode = finalize || tokens.length === 0 ? function () { return null; }
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
