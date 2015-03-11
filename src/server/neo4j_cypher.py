"""
Cypher language parser
   - clear logical separation between lexing/parsing still missing
   - e_XXX class object should be considered internal
"""
import re
from collections import defaultdict
import logging
import Queue

#
# Tokens
#
tok_set__quote = ['`', '\'']

tok_set__paren = ['(', ')', '[', ']', '{', '}']

tok_set__kw__write = [
                      'create',
                      'set',
                      'delete',
                      'remove',
                      'foreach'
                      ]

tok_set__kw__supported = [
                          'create',
                          'match',
                          'optional match',
                          'return',
                          ]

tok_set__kw__unsupported = [
                            'delete',
                            'foreach',
                            'limit',
                            'merge',
                            'order',
                            'remove',
                            'set',
                            'skip',
                            'start',
                            'union',
                            'with',
                            'where',
                            ]

log = logging.getLogger('rhizi')

#
# Parse Tree
#
class pt_abs_node(object):
    """
    Abstract parse tree node
    """
    def __init__(self):
        self.value = None
        self.parent = None

    def __iter__(self):
        return iter([])

    def collapse(self, n_type):
        return self.__collapse_common([n_type])

    def collapse_set(self, n_type_set):
        return self.__collapse_common(n_type_set)

    def __collapse_common(self, n_type_set):

        def type_check(n):
            for n_type in n_type_set:
                if isinstance(n, n_type):
                    return True
            return False

        ret = self
        while not type_check(ret):
            ret = ret.parent

        assert type_check(ret)

        return ret

    def str__body(self):
        return self.value if self.value else ''

    def str__tok_open(self): return ''

    def str__tok_close(self): return ''

class pt_abs_composite_node(pt_abs_node):

    def __init__(self):
        super(pt_abs_composite_node, self).__init__()
        self.sub_exp_set = []

    def str__struct_tree(self):
        return '\n'.join(self.__struct_as_arr__type(0, depth_delim='. '))

    def str__cypher_query(self):
        """
        @return: a Cypher string representation of this parse tree
        """
        return self.__str__cypher_query()

    def str__tok_sibling_delim(self): return ''

    def __str__cypher_query(self):

        def f_pre(n, ctx):
            ctx[0] += n.str__tok_open()

        def f(n, ctx):
            ctx[0] += n.str__body()

        def f_post(n, ctx):
            ctx[0] += n.str__tok_close()

        def f_cascade(n, ctx):
            return True
        
        def f_inter(parent, n, n_next, ctx):
            ctx[0] += parent.str__tok_sibling_delim()

        ctx = ['']
        self.tree_walk__pre(f_pre, f, f_post, f_cascade, f_inter, ctx)
        return ''.join(ctx)

    def __str__cypher_query__sub_node_set(self):
        return ''.join([self.__str__cypher_query__sub_node_single(e) for e in self])

    def __str__cypher_query__sub_node_single(self, e):
        if isinstance(e, pt_abs_composite_node):  # leaf node
            return e.__str__cypher_query()
        else:
            return '%s%s%s' % (e.str__tok_open(), e.str__body(), e.str__tok_close())

    def __struct_as_arr__type(self, depth=0, depth_delim=''):

        ret = []
        prefix_str_d0 = depth_delim * depth
        prefix_str_d1 = depth_delim * (depth + 1)

        ret += ['%s%s: \'%s\'' % (prefix_str_d0, self.__class__.__name__, self.value)]
        for e in self:
            if not isinstance(e, pt_abs_composite_node):  # leaf node
                ret += ['%s%s: \'%s\'' % (prefix_str_d1, e.__class__.__name__, e.value)]
            else:
                ret += (e.__struct_as_arr__type(depth + 1, depth_delim))

        return ret

    def __iter__(self):
        """
        iterate over sub nodes
        """
        for exp in self.sub_exp_set:
            yield exp

    def assert_child_spawn_type(self, n_type):  # provide hook for child spawning assertions
        pass

    def rotate__pin_under_set_node(self):
        n_parent = self.parent
        n_set = e_set()
        n_set.parent = n_parent
        n_set.sub_exp_set.append(self)
        for i in range(0, len(n_parent.sub_exp_set)):
            if self != self.parent.sub_exp_set[i]: continue
            self.parent.sub_exp_set[i] = n_set
        return n_set

    def spawn_child(self, n_type, *args, **kwargs):
        """
        Spawn child node:
           - set child's parent ref. to this object
           - add child node as sub exp.
           
        This method should be overridden by subclasses
        """
        self.assert_child_spawn_type(n_type)

        child_node = n_type(*args, **kwargs)
        child_node.parent = self
        self.sub_exp_set.append(child_node)
        return child_node

    def spawn_sibling(self, n_type=None, *args, **kwargs):

        if not n_type: n_type = self.__class__

        return self.parent.spawn_child(n_type, *args, **kwargs)

    def child_node_by_type(self, node_type):
        ret = []
        for exp in self.sub_exp_set:
            if not isinstance(exp, node_type):
                continue
            ret += [exp]
        return ret

    def tree_walk__pre(self, f_pre, f, f_post, f_cascade, f_inter, ctx=None):

        def walk__pre_rec(n):
            f_pre(n, ctx)
            f(n, ctx)

            if f_cascade(n, ctx):
                sub_n_set = [e for e in n]
                sub_exp_set_len = len(sub_n_set)
                for i in range(0, sub_exp_set_len):
                    e = sub_n_set[i]
                    walk__pre_rec(e)
                    if i + 1 < sub_exp_set_len:
                        e_first = e
                        e_next = sub_n_set[i+1]
                        f_inter(n, e_first, e_next, ctx)

            f_post(n, ctx)

        walk__pre_rec(self)

    def list_interleave(self, l, f):
        l_len = len(l)
        ret = []
        for i in range(0,l_len):
            if i + 1 >= l_len: continue
            e_first = l[i]
            e_second = l[i+1]
            ret += [e_first] + f(e_first, e_second)
        return ret

class e_keyword(pt_abs_node):

    def __init__(self, keyword):
        super(e_keyword, self).__init__()
        self.value = keyword

    def str__tok_close(self):
        return ' '

class e_value(pt_abs_node):

    def __init__(self):
        super(e_value, self).__init__()
        self.quoted = False
        self.quote_tok = None

    @classmethod
    def rgx__unquoted(self, g_name='value'):
        return '(?P<%s>[\w\d]+)' % (g_name)

    @classmethod
    def rgx__quoted(self, g_name='value', quote_tok='\''):
        return '%s(?P<%s>[\w\d\s]+)%s' % (quote_tok, g_name, quote_tok)

    def str__tok_open(self):
        if not self.quoted: return ''
        return self.quote_tok

    def str__tok_close(self):
        if not self.quoted: return ''
        return self.quote_tok

class e_ident(pt_abs_node):  # identifier

    def __init__(self): super(e_ident, self).__init__()

    @classmethod
    def rgx(self, g_name='ident'):
        return '(?P<%s>[\w_]+)' % (g_name)

class e_function(pt_abs_node):  # identifier

    def __init__(self): super(e_function, self).__init__()

class e_set(pt_abs_composite_node):  # identifier
    """
    expression who's all sub nodes are of the same type:
       - may contain sub-expressions of different type: eg. 'match (n), ()-[r]-()'
    """

    def __init__(self): super(e_set, self).__init__()

    def str__tok_sibling_delim(self): return ', '

#
# Cypher patterns
#
class pt_root(pt_abs_composite_node):
    """
    parse tree root node:
       - support keyword-to-clause mapping
    """

    def __init__(self):
        super(pt_root, self).__init__()
        self.kw_to_clause_set_map = defaultdict(list)

    def spawn_child(self, lex_token_type, keyword):  # pt_root: map by keyword on spawn_child()
        ret = super(pt_root, self).spawn_child(lex_token_type)
        self.kw_to_clause_set_map[keyword].append(ret)  # update kw clause map

        return ret

    def assert_child_spawn_type(self, n_type):
        assert issubclass(n_type, e_clause)

    def clause_set_by_kw(self, keyword):
        """
        select query clause set by keyword: eg. 'create' -> [e_clause, ...]
        """
        return self.kw_to_clause_set_map[keyword]

class e_clause(pt_abs_composite_node):

    def __init__(self):
        super(e_clause, self).__init__()

class e_clause__match(e_clause):

    def __init__(self): super(e_clause, self).__init__()

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_keyword, p__node, p__path], n_type

class e_clause__create(e_clause):

    def __init__(self): super(e_clause, self).__init__()

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_keyword, p__node, p__path]

class e__attr_set(e_set):  # attr-set pattern: {k:v, ...}

    def __init__(self): super(e__attr_set, self).__init__()

    def __str__cypher_query__sub_node_set(self):
        return ', '.join([e.__str__cypher_query__sub_node_single() for e in self])

    def str__tok_open(self): return '{'

    def str__tok_close(self): return '}'
    
    def str__tok_sibling_delim(self): return ', '

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_ident, e__kv_pair]

class e_label_set(e_set):

    def __init__(self): super(e_label_set, self).__init__()

    def str__tok_open(self): return ':'

    def str__tok_close(self): return ' '

    def str__tok_sibling_delim(self): return ':'

    def __str__cypher_query__sub_node_set(self):
        return ':'.join([e.__str__cypher_query__sub_node_single() for e in self])

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_value]

class e__kv_pair(pt_abs_composite_node):  # key value pair

    def __init__(self): super(e__kv_pair, self).__init__()

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_value, e_ident]

    def str__tok_sibling_delim(self): return ': '

class p__node(pt_abs_composite_node):  # node pattern: '(...)'
    """
    node pattern
    """

    def __init__(self):
        super(p__node, self).__init__()

    def str__tok_open(self): return '('

    def str__tok_close(self): return ')'

    @property
    def label_set(self):
        return self.child_node_by_type(e_label_set)

    @classmethod
    def rgx(self, g_name): return '\((?P<%s>[^\(\)]*?)\)' % (g_name)

class p__rel(pt_abs_composite_node):  # rel pattern: '[...]'
    """
    relationship pattern
    """

    def __init__(self): super(p__rel, self).__init__()

    def __str__(self):
        return '%s%s' % (self.id if self.id else '',
                        ':' + self.type if self.type else '')

    def str__tok_open(self): return '-['

    def str__tok_close(self): return ']-'

    @property
    def type(self):
        val_sub_n_set = self.child_node_by_type(e_value)

        assert len(val_sub_n_set) >= 1

        if len(val_sub_n_set) == 1:
            return val_sub_n_set[0]
        return None

    @classmethod
    def rgx(self, g_name): return '-\[(?P<%s>[^\[\]]*?)\]->?' % (g_name)

class p__path(pt_abs_composite_node):  # path pattern: '()-[]-()'
    """
    path pattern
    """
    def __init__(self): super(p__path, self).__init__()


class Cypher_Parser(object):
    """
    Neo4J Cypher language parser
    """

    def __init__(self):
        pass

    def parse_expression(self, input):
        """
        @return: Cypher parse tree
        """
        root_node = pt_root()
        try:
            self.__parse(input, root_node)
        except Exception as e:
            log.exception(e)
            log.debug('parse tree:\n%s' % (root_node.str__struct_tree()))
            raise e

        return root_node

    def __match(self, rgx, input):  # error handling match
        ret = re.match(rgx, input)
        if not ret:
            raise Exception('cypher parse error: rgx match failure: rgx: %s, input: "%s"' % (rgx, input))
        return ret

    def first_sibling_root(self, n):
        ret = n
        while not ret.__class__ in [e__attr_set,
                                    e_clause]:
            ret = ret.parent

        return ret

    def cont(self, n):
        if isinstance(n, e_label_set):
            pass

    def __parse(self, input, n_cur):

        rgx__suffix = '(?P<suffix>.*)$'  # suffix regular expression, '$' terminated

        def parse__node(input, n_cur):
            n_cur = n_cur.spawn_child(p__node)
            return self.__parse(input[1:], n_cur)

        def parse__node_or_path(input, n_cur):
            # path pattern
            rgx_path = r'^%s%s%s' % (p__node.rgx('src'),
                                     p__rel.rgx('rel'),
                                     p__node.rgx('dst'))
            m = re.match(rgx_path, input)
            if m:
                n_cur = n_cur.spawn_child(p__path)
                n_cur = n_cur.spawn_child(p__node)
                return self.__parse(input[1:], n_cur)

            # node pattern
            rgx_path = r'^%s' % (p__node.rgx('src'))
            m = re.match(rgx_path, input)
            if m:
                return parse__node(input, n_cur)

            assert False, 'failed parsing attr_set or identifier, input: "%s"' % (input)

        def parse__rel_close(input, n_cur):
            n_cur = n_cur.collapse(p__rel).parent
            if input.startswith(']->'):  # close directional-rel
                return self.__parse(input[3:], n_cur)
            if input.startswith(']-'):  # close directional-rel
                return self.__parse(input[2:], n_cur)

            assert False, 'failed parsing rel termination'

        if None == input or 0 == len(input):  # end of input or opt regex group not found
            return

        if isinstance(n_cur, pt_root):
            #
            # keywords
            #
            for kw in tok_set__kw__supported:  # handle keywords
                if input.startswith(kw):
                    kw_clause_type = globals().get('e_clause__' + kw)
                    clause_type = kw_clause_type if kw_clause_type else e_clause
                    n_cur = n_cur.spawn_child(clause_type, kw)
                    n_cur.spawn_child(e_keyword, kw)
                    return self.__parse(input[len(kw):], n_cur)

            for kw in tok_set__kw__unsupported:  # currently unsupported keywords
                if input.startswith(kw):
                    assert False, 'cypher parse: unsupported keyword: \'%s\', input: "%s"' % (kw, input)

            assert False

        if isinstance(n_cur, e_clause):
            if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

            if '(' == input[0]: return parse__node_or_path(input, n_cur) # open node or path

            if ',' == input[0]:  # open sibling

                assert len(n_cur.sub_exp_set) >= 2 and e_keyword == n_cur.sub_exp_set[0].__class__

                last_child = n_cur.sub_exp_set[-1]
                assert last_child.__class__ in [p__path, p__node]

                n_cur = last_child.rotate__pin_under_set_node()
                return self.__parse(input[1:], n_cur)

        if isinstance(n_cur, e_ident):
            rgx_ident = r'^%s%s' % (e_ident.rgx(), rgx__suffix)
            m = self.__match(rgx_ident, input)

            n_cur.value = m.group('ident')
            return self.__parse(m.group('suffix'), n_cur.parent)

        #
        # e_set & subclasses - ordered by specificity
        #
        if isinstance(n_cur, e_label_set):
            if ' ' == input[0]:  # close label set
                return self.__parse(input[1:], n_cur.collapse_set([p__rel, p__node]))
            if ':' == input[0]:  # append to label set
                n_cur = n_cur.spawn_child(e_value)
                return self.__parse(input[1:], n_cur)
            if ')' == input[0]:  # close node/path
                n_cur = n_cur.collapse(p__node).parent
                return self.__parse(input[1:], n_cur)
            if ']' == input[0]: return parse__rel_close(input, n_cur) # close rel
            assert False

        if isinstance(n_cur, e__attr_set):
            if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

            if '}' == input[0]:  # close attr-set
                n_cur = n_cur.collapse(e__attr_set).parent
                return self.__parse(input[1:], n_cur)

            if ')' == input[0]: return parse__node(input[1:], n_cur.parent) # collapse

            rgx_attr_set_or_param = r'^((%s:)|(%s))' % (e_ident.rgx('kv_pair__key'),
                                                        e_ident.rgx('ident'))
            m = self.__match(rgx_attr_set_or_param, input)
            if m.group('ident'):
                n_cur = n_cur.spawn_child(e_ident)
                return self.__parse(input, n_cur)
            if m.group('kv_pair__key'):
                n_cur = n_cur.spawn_child(e__kv_pair)
                return self.__parse(input, n_cur)

            assert False, 'failed parsing attr_set or identifier, input: "%s"' % (input)

        if isinstance(n_cur, e_set):
            if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

            if '(' == input[0]:  # open node or path
                return parse__node_or_path(input, n_cur)
        #
        # end of e_set & subclasses
        #

        if isinstance(n_cur, e_value):
            if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

            if input[0] in tok_set__quote:  # quoted value
                quote_tok = input[0]
                rgx_value = r'^%s%s' % (e_value.rgx__quoted(quote_tok=quote_tok),
                                        rgx__suffix)
                n_cur.quoted = True
                n_cur.quote_tok = quote_tok
            else:  # non quoted value
                rgx_value = r'^%s%s' % (e_value.rgx__unquoted(), rgx__suffix)

            m = self.__match(rgx_value, input)
            n_cur.value = m.group('value')

            return self.__parse(m.group('suffix'), n_cur.parent)

        if isinstance(n_cur, e__kv_pair):
            if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

            if ',' == input[0]:  # open sibling
                n_cur = n_cur.spawn_sibling()
                return self.__parse(input[1:], n_cur)

            if ':' == input[0]:  # open sibling
                n_cur = n_cur.spawn_child(e_value)
                return self.__parse(input[1:], n_cur)

            if '{' == input[0]:  # open param
                assert False, 'params not supported yet'

            if not n_cur.child_node_by_type(e_ident):  # kv_pair key yet to be set
                n_cur = n_cur.spawn_child(e_ident)
                return self.__parse(input, n_cur)

            if len(n_cur.sub_exp_set) == 2: return self.__parse(input, n_cur.parent) # collapse

            assert False

        if n_cur.__class__ in [p__rel, p__node]:  # node or rel
            if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

            if ':' == input[0]: # open label set
                n_cur = n_cur.spawn_child(e_label_set)
                n_cur = n_cur.spawn_child(e_value)
                return self.__parse(input[1:], n_cur)

            if '{' == input[0]:  # open attr-set
                n_cur = n_cur.spawn_child(e__attr_set)
                return self.__parse(input[1:], n_cur)

            if ')' == input[0]:  # close node/path
                n_cur = n_cur.collapse(p__node).parent
                return self.__parse(input[1:], n_cur)

            if ']' == input[0]: return parse__rel_close(input, n_cur) # close rel

            rgx_opt_id = r'^%s' % (e_ident.rgx('ident'))
            m = re.match(rgx_opt_id, input)
            if m:
                n_cur = n_cur.spawn_child(e_ident)
                return self.__parse(input, n_cur)

            return self.__parse(input, n_cur)

        if isinstance(n_cur, p__path):

            if len(n_cur.sub_exp_set) == 3: return self.__parse(input, n_cur.parent) # collapse

            if '(' == input[0]: return parse__node(input, n_cur) # open node or path

            if input.startswith('-['):  # open rel
                n_cur = n_cur.spawn_child(p__rel)
                return self.__parse(input[2:], n_cur)

            if ']' == input[0]: return parse__rel_close(input, n_cur) # close rel

            assert False
