"""
Cypher language parser
   - clear logical separation between lexing/parsing still missing
   - e_XXX class object should be considered internal
"""
import re
from collections import defaultdict
import logging
from enum import Enum

#
#

log = logging.getLogger('rhizi')

class Query_Struct_Type(Enum):
    unkown = 1
    r = 2
    w = 3
    rw = 4

    def __add__(self, other):
        if self == other or self == pt_root.Query_Struct_Type.rw:
            return self
        if self == Query_Struct_Type.unkown:
            return other
        if self == Query_Struct_Type.r and other != Query_Struct_Type.r:
            return Query_Struct_Type.rw
        if self == Query_Struct_Type.w and other != Query_Struct_Type.w:
            return Query_Struct_Type.rw

    def __str__(self):
        if self == Query_Struct_Type.unkown: return 'unkown'
        if self == Query_Struct_Type.r: return 'r'
        if self == Query_Struct_Type.w: return 'w'
        if self == Query_Struct_Type.rw: return 'rw'
        assert False

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
        n_parent = self.parent
        n_set = n_type()
        n_set.parent = n_parent
        n_set.sub_exp_set.append(self)
        for i in range(0, len(n_parent.sub_exp_set)):
            if self != self.parent.sub_exp_set[i]: # lookup self in parent child set 
                continue
            self.parent.sub_exp_set[i] = n_set
        return n_set

    def str__body(self): return self.value if self.value else ''

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

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ''

    def __str__cypher_query(self):

        def f_pre(n, ctx): ctx[0] += n.str__tok_open()
        def f_visit(n, ctx): ctx[0] += n.str__body()
        def f_post(n, ctx): ctx[0] += n.str__tok_close()
        def f_cascade(n, ctx): return True

        def f_inter(parent, n, n_next, ctx):
            ctx[0] += parent.str__tok_sibling_delim(n, n_next)

        ctx = ['']
        self.tree_walk__pre(f_pre, f_visit, f_post, f_cascade, f_inter, ctx)
        return ''.join(ctx)

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

    def __iter__(self): # iterate over sub nodes
        for exp in self.sub_exp_set:
            yield exp

    def assert_child_spawn_type(self, n_type):  # provide hook for child spawning assertions
        pass

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
        if not n_type: # by default spawn siblig of the same type as self
            n_type = self.__class__
        return self.parent.spawn_child(n_type, *args, **kwargs)

    def child_node_by_type(self, node_type):
        ret = []
        for exp in self.sub_exp_set:
            if not isinstance(exp, node_type):
                continue
            ret += [exp]
        return ret

    def tree_walk__pre(self, f_pre, f_visit, f_post, f_cascade, f_inter, ctx=None): # tree walk, preorder

        def walk__pre_rec(n):
            f_pre(n, ctx)
            f_visit(n, ctx)

            if f_cascade(n, ctx):
                sub_n_set = [e for e in n]
                sub_exp_set_len = len(sub_n_set)
                for i in range(0, sub_exp_set_len):
                    e = sub_n_set[i]
                    walk__pre_rec(e)
                    if i + 1 < sub_exp_set_len: # call f_inter in between siblings
                        e_first = e
                        e_next = sub_n_set[i + 1]
                        f_inter(n, e_first, e_next, ctx)

            f_post(n, ctx)

        walk__pre_rec(self)

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
        return '(?P<%s>[\w\d_]+)' % (g_name)

    @classmethod
    def rgx__quoted(self, g_name='value', quote_tok='\''):
        return '%s(?P<%s>[\w\d_\-\s]+)%s' % (quote_tok, g_name, quote_tok)

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

class e_param(e_ident):  # identifier

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
        self.kw_to_clause_set_map = defaultdict(list)

    def assert_child_spawn_type(self, n_type):
        assert issubclass(n_type, e_clause)

    def clause_set_by_kw(self, keyword):
        """
        select query clause set by keyword: eg. 'create' -> [e_clause, ...]
        """
        return self.kw_to_clause_set_map[keyword]

    @property
    def query_struct_type(self):
        """
        calc query_structure_type: read|write|read-write
        """
        ret = Query_Struct_Type.unkown
        for kw, _clause_set in self:
            if kw in self.q_tree.tok_set__kw__write:
                ret += self.q_tree.Query_Struct_Type.w
            if kw == 'match':
                ret += self.q_tree.Query_Struct_Type.r

        return ret

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ' '

class e_clause(pt_abs_composite_node):

    def __init__(self):
        super(e_clause, self).__init__()

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

class e_kv_pair(pt_abs_composite_node):  # key value pair

    def __init__(self): super(e_kv_pair, self).__init__()

    def assert_child_spawn_type(self, n_type):
        assert n_type in [e_value, e_ident, e_param]

    def str__tok_sibling_delim(self, sib_a=None, sib_b=None): return ': '

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

    @property
    def label_set(self):
        return self.child_node_by_type(e_label_set)

    @classmethod
    def rgx(self, g_name): return '\((?P<%s>[^\(\)]*?)\)' % (g_name)

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
    def type(self): # the single element equivalent of node label sets
        val_sub_n_set = self.child_node_by_type(e_value)

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
        while not ret.__class__ in [e_attr_set,
                                    e_clause]:
            ret = ret.parent

        return ret

    def cont(self, n):
        if isinstance(n, e_label_set):
            pass

    def read__e_ident(self, input, n_ident):
        rgx_ident = r'^%s%s' % (e_ident.rgx(), self.rgx__suffix)
        m = self.__match(rgx_ident, input)
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

        m = self.__match(rgx_value, input)
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
        m = self.__match(rgx_attr_set_or_param, input)
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

        if not n_cur.child_node_by_type(e_ident):  # kv_pair key yet to be set
            n_cur = n_cur.spawn_child(e_ident)
            return self.__parse(input, n_cur)

        if len(n_cur.sub_exp_set) == 2: return self.__parse(input, n_cur.parent)  # collapse

    def parse__e_val_or_param(self, input, n_cur):
        if ' ' == input[0]: return self.parse__e_val_or_param(input[1:], n_cur)  # consume

        if '{' == input[0]:
            n_cur = n_cur.spawn_child(e_param)
            return self.parse__e_param(input[1:], n_cur)

        n_cur = n_cur.spawn_child(e_value)
        return self.__parse(input, n_cur)

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

        if '}' == input[0]:  # close node/path
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
                n_root.kw_to_clause_set_map[kw].append(n_root)  # update kw clause map
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
