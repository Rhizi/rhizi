"""
Cypher language parser
   - clear logical separation between lexing/parsing still missing
   - e_XXX class object should be considered internal
"""

import re
from collections import defaultdict
import logging

#
# Tokens
#
tok__quote__backquote = '`'  # used to quote labels
tok__quote__singlequote = '\''  # used to quote values
tok_set__quote = [tok__quote__backquote, tok__quote__singlequote]

tok_set__paren = ['(', ')', '[', ']', '{', '}']

tok_set__kw__write = [
                      'create',
                      'set',
                      'delete',
                      'remove',
                      'foreach'
                      ]

tok_set__kw__supported = [  # order critical
                          'create',
                          'optional match',
                          'match',
                          ]

tok_set__kw__unsupported = [  # these are treated as generic clauses, capturing until the next keyword
                            'delete',
                            'foreach',
                            'limit',
                            'merge',
                            'order by',
                            'return',
                            'remove',
                            'set',
                            'skip',
                            'start',
                            'union',
                            'where',
                            'with',
                            ]

tok_set__kw__all = tok_set__kw__supported + tok_set__kw__unsupported

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

    def __iter__(self): return iter([])  # enable tree walking over pt_abs_node leaf nodes

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

    def rotate__pin_under_new_parent(self, n_type):  # pin current node under a new parent node
        parent_cur = self.parent
        parent_new = n_type()
        parent_new.parent = parent_cur
        parent_new.sub_exp_set.append(self)
        for i in range(0, len(parent_cur.sub_exp_set)):
            if self != self.parent.sub_exp_set[i]:  # lookup self in parent child set
                continue
            parent_cur.sub_exp_set[i] = parent_new
        self.parent = parent_new
        return parent_new

    def spawn_sibling(self, n_type=None, *args, **kwargs):
        if not n_type:  # by default spawn siblig of the same type as self
            n_type = self.__class__
        return self.parent.spawn_child(n_type, *args, **kwargs)

    def spawn_sibling__adjacent(self, n_type=None, *args, **kwargs):
        """
        spawn sibling, immediately following self in the sub-exp order
        """
        if not n_type:  # by default spawn siblig of the same type as self
            n_type = self.__class__

        i = 0  # position of self in parent sub-exp set
        p_exp_set = self.parent.sub_exp_set
        for exp in p_exp_set:
            if exp == self:
                break
            i += 1

        child_node = n_type(*args, **kwargs)
        child_node.parent = self

        p_exp_set.insert(i + 1, child_node)
        return child_node

    def str__body(self): return self.value if self.value else ''

    def str__tok_open(self): return ''

    def str__tok_close(self): return ''

class pt_abs_composite_node(pt_abs_node):

    def __init__(self):
        super(pt_abs_composite_node, self).__init__()
        self.sub_exp_set = []

    def __repr__(self):
        return self.str__struct_tree()

    def __str__cypher_query(self):

        def f_pre(n, ctx): ctx[0] += n.str__tok_open()
        def f_visit(n, ctx, _depth): ctx[0] += n.str__body()
        def f_post(n, ctx): ctx[0] += n.str__tok_close()
        def f_recurse(n, ctx, depth): return True
        def f_inter(parent, n, n_next, ctx): ctx[0] += parent.str__tok_sibling_delim(n, n_next)

        ctx = ['']
        self.tree_walk__pre(f_pre, f_visit, f_post, f_recurse, f_inter, ctx)
        return ''.join(ctx)

    def __str__struct_tree(self, depth_delim=''):

        def f_visit(n, ctx, depth):
            line = '%s%s' % (depth_delim * depth, n.__class__.__name__)
            if n.value:
                line += ': \'%s\'' % (n.value)
            ctx += [line]

        ctx = []
        self.tree_walk__pre(f_visit=f_visit, ctx=ctx)
        return ctx

    def __iter__(self):  # iterate over sub nodes
        for exp in self.sub_exp_set:
            yield exp

    def assert_child_spawn_type(self, n_type):  # provide hook for child spawning assertions
        pass

    def str__struct_tree(self):
        return '\n'.join(self.__str__struct_tree(depth_delim='. '))

    def str__cypher_query(self):
        """
        @return: a Cypher string representation of this parse tree
        """
        return self.__str__cypher_query()

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ''

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

    def sub_exp_set_by_type(self, exp_type_or_set, recurse=False):
        """
        @param exp_type_or_set: type or set of types to check against using isinstance()
        @param recurse: whether to recursively search within sub expressions
        
        @return: set of matched sub expressions who match the given type set, possibly empty
        """

        if isinstance(exp_type_or_set, list):
            exp_type_set = exp_type_or_set
        else:
            exp_type_set = [exp_type_or_set]

        def f_visit(n, ctx, depth):
            for exp_type in exp_type_set:
                if isinstance(n, exp_type): ctx += [n]

        if False == recurse:
            f_recurse = lambda _n, _ctx, depth: depth <= 1 # [!] visit child nodes only 
        if True == recurse:
            f_recurse = lambda _n, _ctx, _depth: True # recurse
        return self.tree_walk__pre(f_visit=f_visit, f_recurse=f_recurse, ctx=[])

    def tree_walk__pre(self, f_pre=lambda n, ctx: None,
                             f_visit=lambda n, ctx, depth: None,
                             f_post=lambda n, ctx: None,
                             f_recurse=lambda n, ctx, depth: True,
                             f_inter=lambda n, e_first, e_next, ctx: None,  # called between each sibling pair
                             ctx=None):  # tree walk, preorder

        def walk__pre_rec(n, depth):
            f_pre(n, ctx)
            f_visit(n, ctx, depth)

            if f_recurse(n, ctx, depth):
                sub_n_set = [e for e in n]
                sub_exp_set_len = len(sub_n_set)
                for i in range(0, sub_exp_set_len):
                    e = sub_n_set[i]
                    walk__pre_rec(e, depth + 1)
                    if i + 1 < sub_exp_set_len:  # call f_inter in between siblings
                        e_first = e
                        e_next = sub_n_set[i + 1]
                        f_inter(n, e_first, e_next, ctx)

            f_post(n, ctx)

        walk__pre_rec(self, 0)
        return ctx

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
        return '(?P<%s>[\w\d_]+(\*\d*\.\.\d*)?)' % (g_name)

    @classmethod
    def rgx__quoted(self, g_name='value', quote_tok='\''):
        return '%s(?P<%s>[\w\d_\-\s]+(\*\d*\.\.\d*)?)%s' % (quote_tok, g_name, quote_tok)

    def str__tok_open(self):
        if self.quoted: return self.quote_tok
        return ''

    def str__tok_close(self):
        if self.quoted: return self.quote_tok
        return ''

class e_ident(pt_abs_node):  # identifier

    def __init__(self): super(e_ident, self).__init__()

    @classmethod
    def rgx(self, g_name='ident'):
        return '(?P<%s>[\w_]+)' % (g_name)

class e_param(e_ident):
    """
    Cypher parameter

    @TODO: implement as bound e_ident
    """

    def __init__(self): super(e_param, self).__init__()

    def str__tok_open(self): return '{'

    def str__tok_close(self): return '}'

class e_function(pt_abs_node):  # identifier

    def __init__(self): super(e_function, self).__init__()

class e_set(pt_abs_composite_node):  # identifier
    """
    expression who's all sub nodes are of the same type:
       - may contain sub-expressions of different type: eg. 'match (n), ()-[r]-()'
    """

    def __init__(self): super(e_set, self).__init__()

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ', '

class op_dot(pt_abs_composite_node):

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return '.'

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

    def assert_child_spawn_type(self, n_type):
        assert issubclass(n_type, e_clause)

    def index__kw_to_clause_set(self):
        ret = defaultdict(list)
        for e_clause in self:
            ret[e_clause.keyword_str].append(e_clause)
        return ret

    def clause_set_by_kw(self, keyword):
        """
        select query clause set by keyword: eg. 'create' -> [e_clause, ...]
        """
        return self.index__kw_to_clause_set()[keyword]

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ' '

class e_clause(pt_abs_composite_node):

    def __init__(self):
        super(e_clause, self).__init__()

    @property
    def keyword_str(self):
        ret = self.sub_exp_set[0]

        assert isinstance(ret, e_keyword)

        return ret.value

class e_clause__match(e_clause):

    def __init__(self):
        super(e_clause__match, self).__init__()
        self.is_optional = False

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_keyword, p_node, p_path], n_type

class e_clause__create(e_clause):

    def __init__(self): super(e_clause__create, self).__init__()

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_keyword, p_node, p_path]

class e_clause__where(e_clause):

    def __init__(self): super(e_clause__where, self).__init__()

    @property
    def condition_value(self):
        assert len(self.sub_exp_set) == 2

        return self.sub_exp_set[1].value

    def set_condition(self, cond_str):
        assert len(self.sub_exp_set) == 2

        self.sub_exp_set[1].value = cond_str

class e_attr_set(e_set):  # attr-set pattern: {k:v, ...}

    def __init__(self): super(e_attr_set, self).__init__()

    def str__tok_open(self): return '{'

    def str__tok_close(self): return '}'

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ', '

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_ident, e_kv_pair]

class e_label_set(e_set):

    def __init__(self): super(e_label_set, self).__init__()

    def str__tok_open(self): return ':'  # required when no identifier is present, eg. '()-[:A]-()'

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ':'

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_value]

    def add_label(self, label):
        lbl = self.spawn_child(e_value)
        lbl.value = label
        return lbl

class e_kv_pair(pt_abs_composite_node):  # key value pair

    def __init__(self): super(e_kv_pair, self).__init__()

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_value, e_ident, e_param]

    def spawn_child(self, n_type, *args, **kwargs):
        ret = pt_abs_composite_node.spawn_child(self, n_type, *args, **kwargs)

        assert len(self.sub_exp_set) <= 2

        return ret

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ': '

    def is_set__key(self):
        return len(self.sub_exp_set) > 0 and self.sub_exp_set[0].__class__ == e_ident

    def is_set__value(self):
        return len(self.sub_exp_set) == 2

class p_node(pt_abs_composite_node):  # node pattern: '(...)'
    """
    node pattern
    """

    def __init__(self):
        super(p_node, self).__init__()

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None):
        if isinstance(sib_a, e_ident) and isinstance(sib_b, e_label_set):
            return ''  # handled by label_set
        return ' '

    def str__tok_open(self): return '('

    def str__tok_close(self): return ')'

    @classmethod
    def rgx(self, g_name): return '\((?P<%s>[^\(\)]*?)\)' % (g_name)

    @property
    def label_set(self):
        sub_exp_set = self.sub_exp_set_by_type(e_label_set)
        if 0 == len (sub_exp_set):
            return None
        assert 1 == len(sub_exp_set)
        return sub_exp_set.pop()

    def spawn_label_set(self):
        """
        spawn label set adjacent to e_ident
        """

        assert not self.label_set, 'label set already present'
        assert len(self.sub_exp_set) > 0
        assert e_ident == self.sub_exp_set[0].__class__

        e_id = self.sub_exp_set[0]
        lbl_set = e_id.spawn_sibling__adjacent(e_label_set)
        return lbl_set

class p_rel(pt_abs_composite_node):  # rel pattern: '[...]'
    """
    relationship pattern
    """

    def __init__(self):
        super(p_rel, self).__init__()
        self.is_directional = False

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None):
        if isinstance(sib_a, e_ident) and isinstance(sib_b, e_label_set):
            return ''  # handled by label_set
        return ' '

    def str__tok_open(self): return '-['

    def str__tok_close(self):
        if self.is_directional == True:
            return ']->'
        else:
            return ']-'

    @property
    def type(self):
        """
        The single element equivalent of node label sets
        """
        val_sub_n_set = self.sub_exp_set_by_type(e_value)

        assert len(val_sub_n_set) >= 1

        if len(val_sub_n_set) == 1:
            return val_sub_n_set[0]
        return None

    @classmethod
    def rgx(self, g_name): return '-\[(?P<%s>[^\[\]]*?)\]->?' % (g_name)

class p_path(pt_abs_composite_node):  # path pattern: '()-[]-()'
    """
    path pattern
    """
    def __init__(self): super(p_path, self).__init__()

class Cypher_Parser(object):
    """
    Neo4J Cypher language parser - conventions:
       - read_xxx functions: should adjust argument node without modifying parse tree
       - parse_xxx functions:
          - caller should spawn correct current node 
          - should handle current node closing
          - default parse case should recurse up via parent node 
    """

    def __init__(self):
        self.rgx__suffix = '(?P<suffix>.*)$'  # suffix regular expression, '$' terminated

    def parse_expression(self, input):
        """
        @return: Cypher parse tree
        """
        root_node = pt_root()
        try:
            self.__parse(input, root_node)
        except Exception as e:
            log.exception(e)
            log.debug('parse tree:\n%s\nq: %s' % (root_node.str__struct_tree(), input))
            raise e

        return root_node

    def __match(self, rgx, input_str, flags=0):  # error handling match
        ret = re.match(rgx, input_str, flags)
        if not ret:
            raise Exception('cypher parse error: rgx match failure: rgx: %s, input: "%s"' % (rgx, input_str))
        return ret

    def first_sibling_root(self, n):
        ret = n
        while not ret.__class__ in [e_attr_set,
                                    e_clause]:
            ret = ret.parent

        return ret

    def cont(self, n):
        if isinstance(n, e_label_set):
            pass

    def read__e_ident(self, input, n_ident):
        rgx_ident = r'^%s%s' % (e_ident.rgx(), self.rgx__suffix)
        m = self.__match(rgx_ident, input, re.UNICODE)
        n_ident.value = m.group('ident')
        return m.group('suffix')

    def read__e_value(self, input, n_value):
        if input[0] in tok_set__quote:  # quoted value
            quote_tok = input[0]
            rgx_value = r'^%s%s' % (e_value.rgx__quoted(quote_tok=quote_tok),
                                    self.rgx__suffix)
            n_value.quoted = True
            n_value.quote_tok = quote_tok
        else:  # non quoted value
            rgx_value = r'^%s%s' % (e_value.rgx__unquoted(), self.rgx__suffix)

        m = self.__match(rgx_value, input, re.UNICODE)
        n_value.value = m.group('value')
        return m.group('suffix')

    def parse__e_attr_set(self, input, n_cur):
        if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

        if '{' == input[0]:  # open param
            n_cur = n_cur.spawn_child(e_param)
            return self.__parse(input[1:], n_cur)

        if '}' == input[0]:  # close attr-set
            n_cur = n_cur.collapse(e_attr_set).parent
            return self.__parse(input[1:], n_cur)

        rgx_attr_set_or_param = r'^((%s:)|(%s))' % (e_ident.rgx('kv_pair__key'),
                                                    e_ident.rgx('ident'))
        m = self.__match(rgx_attr_set_or_param, input, re.UNICODE)
        if m.group('ident'):
            n_cur = n_cur.spawn_child(e_ident)
            return self.__parse(input, n_cur)
        if m.group('kv_pair__key'):
            n_cur = n_cur.spawn_child(e_kv_pair)
            return self.__parse(input, n_cur)

        n_cur = n_cur.parent
        return self.__parse(input, n_cur)

    def parse__e_clause_create_or_match(self, input, n_cur):
        if ' ' == input[0]: return self.parse__e_clause_create_or_match(input[1:], n_cur)  # consume

        if '(' == input[0]: return self.parse__node_or_rel(input, n_cur)  # open node or path

        if ',' == input[0]:  # open sibling
            assert len(n_cur.sub_exp_set) >= 2 and e_keyword == n_cur.sub_exp_set[0].__class__

            last_child = n_cur.sub_exp_set[-1]
            assert last_child.__class__ in [p_path, p_node]

            n_cur = last_child.rotate__pin_under_new_parent(e_set)
            return self.__parse(input[1:], n_cur)

        n_cur = n_cur.parent
        return self.__parse(input, n_cur)

    def parse__e_clause__common(self, input, n_cur):
        assert len(n_cur.sub_exp_set) == 2
        assert n_cur.sub_exp_set[1].__class__ == e_value

        n_val = n_cur.sub_exp_set[1]
        for kw in tok_set__kw__all:
            if input.startswith(kw + ' '):
                n_val.value = n_val.value.strip()  # trim before handling new kw
                n_cur = n_cur.parent
                return self.__parse(input, n_cur)

        n_val.value += input[0]
        if len(input) == 1:  # trim on EOI
            n_val.value = n_val.value.strip()
        return self.__parse(input[1:], n_cur)

    def parse__e_ident(self, input, n_cur):
        suffix = self.read__e_ident(input, n_cur)
        n_cur = n_cur.parent
        return self.__parse(suffix, n_cur)

    def parse__e_kv_pair(self, input, n_cur):
        if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

        if ',' == input[0]:  # open sibling
            n_cur = n_cur.spawn_sibling()
            return self.__parse(input[1:], n_cur)

        if ':' == input[0]:  # open sibling
            return self.parse__e_val_or_param(input[1:], n_cur)

        if not n_cur.is_set__value(): # kv_pair key yet to be set
            n_cur = n_cur.spawn_child(e_ident)
            return self.__parse(input, n_cur)

        if n_cur.is_set__value() and n_cur.is_set__key():
            n_cur = n_cur.parent
            return self.__parse(input, n_cur)  # collapse

    def parse__e_val_or_param(self, input, n_cur):
        if ' ' == input[0]: return self.parse__e_val_or_param(input[1:], n_cur)  # consume

        if '{' == input[0]:
            n_cur = n_cur.spawn_child(e_param)
            return self.parse__e_param(input[1:], n_cur)
        else:
            n_cur = n_cur.spawn_child(e_value)
            return self.__parse(input, n_cur)
        assert False

    def parse__e_label_set(self, input, n_cur):
        if ' ' == input[0]:  # close label set
            return self.__parse(input[1:], n_cur.collapse_set([p_rel, p_node]))
        if ':' == input[0]:  # append to label set
            n_cur = n_cur.spawn_child(e_value)
            return self.__parse(input[1:], n_cur)
        if input[0] in [')', ']']:
            n_cur = n_cur.parent
            return self.__parse(input, n_cur)
        assert False

    def parse__e_param(self, input, n_cur):
        if input.startswith('}.'):
            n_cur = n_cur.rotate__pin_under_new_parent(op_dot)
            return self.__parse(input[2:], n_cur)

        if '}' == input[0]:  # close param
            n_cur = n_cur.parent
            return self.__parse(input[1:], n_cur)

        suffix = self.read__e_ident(input, n_cur)
        return self.__parse(suffix, n_cur)

    def parse__e_set(self, input, n_cur):
        if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

        if '(' == input[0]:  # open node or path
            return self.parse__node_or_rel(input, n_cur)

        n_cur = n_cur.parent
        return self.__parse(input, n_cur)

    def parse__e_value(self, input, n_cur):
        if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

        suffix = self.read__e_value(input, n_cur)
        n_cur = n_cur.parent
        return self.__parse(suffix, n_cur)

    def parse__node_or_rel(self, input, n_cur):
        if ' ' == input[0]: return self.__parse(input[1:], n_cur)  # consume

        if ':' == input[0]:  # open label set
            n_cur = n_cur.spawn_child(e_label_set)
            n_cur = n_cur.spawn_child(e_value)
            return self.__parse(input[1:], n_cur)

        if '(' == input[0]:  # open node
            n_cur = n_cur.spawn_child(p_node)
            return self.parse__node_or_rel(input[1:], n_cur)

        if ')' == input[0]:  # close node/path
            if input.startswith(')-'):  # open path
                n_cur = n_cur.rotate__pin_under_new_parent(p_path)
                return self.parse__node_or_rel(input[1:], n_cur)

            n_cur = n_cur.parent
            if n_cur.__class__ == p_path:
                n_cur = n_cur.parent
            return self.__parse(input[1:], n_cur)

        if input.startswith('-['):  # open rel
            n_cur = n_cur.spawn_child(p_rel)
            return self.parse__node_or_rel(input[2:], n_cur)

        if input.startswith(']-'):  # close directional-rel
            if input.startswith(']->'):  # close directional-rel
                n_cur.is_directional = True
                n_cur = n_cur.parent
                return self.parse__node_or_rel(input[3:], n_cur)

            n_cur = n_cur.parent
            return self.parse__node_or_rel(input[2:], n_cur)

        if '{' == input[0]:  # open attr-set
            n_cur = n_cur.spawn_child(e_attr_set)
            return self.__parse(input[1:], n_cur)

        rgx_opt_id = r'^%s' % (e_ident.rgx('ident'))
        m = re.match(rgx_opt_id, input)
        if m:
            n_cur = n_cur.spawn_child(e_ident)
            return self.__parse(input, n_cur)

        assert False

    def parse__op_dot(self, input, op_dot):
        n_ident = op_dot.spawn_child(e_ident)
        input_suffix = self.read__e_ident(input, n_ident)
        n_cur = op_dot.parent  # collapse
        return self.__parse(input_suffix, n_cur)

    def parse__pt_root(self, input, n_root):
        #
        # keywords
        #
        for kw in tok_set__kw__all:  # handle keywords
            if input.startswith(kw):
                clause_type = globals().get('e_clause__' + kw)
                if 'optional match' == kw:
                    clause_type = e_clause__match
                if not clause_type:
                    clause_type = e_clause

                n_cur = n_root.spawn_child(clause_type)
                if 'optional match' == kw:
                    n_cur.is_optional = True

                n_cur.spawn_child(e_keyword, kw)

                if kw in tok_set__kw__unsupported:  # generic e_clause case
                    n_value = n_cur.spawn_child(e_value)
                    n_value.value = ''

                return self.__parse(input[len(kw):], n_cur)

    def __parse(self, input, n_cur):

        if None == input or 0 == len(input):  # end of input or opt regex group not found
            return

        #
        # order sensitive to specificity:
        #    - e_clause_match, e_clause_create > e_clause
        #    - e_param > e_ident
        #    - e_label_set, e_attr_set > e_set
        #
        if isinstance(n_cur, e_clause__create): return self.parse__e_clause_create_or_match(input, n_cur)
        if isinstance(n_cur, e_clause__match): return self.parse__e_clause_create_or_match(input, n_cur)
        if isinstance(n_cur, e_clause__where): return self.parse__e_clause__common(input, n_cur)
        if isinstance(n_cur, e_clause): return self.parse__e_clause__common(input, n_cur)

        if isinstance(n_cur, p_rel): return self.parse__node_or_rel(input, n_cur)
        if isinstance(n_cur, p_node): return self.parse__node_or_rel(input, n_cur)

        if isinstance(n_cur, e_label_set): return self.parse__e_label_set(input, n_cur)
        if isinstance(n_cur, e_attr_set): return self.parse__e_attr_set(input, n_cur)
        if isinstance(n_cur, e_set): return self.parse__e_set(input, n_cur)

        f_parse = getattr(self, 'parse__' + n_cur.__class__.__name__)
        return f_parse(input, n_cur)
