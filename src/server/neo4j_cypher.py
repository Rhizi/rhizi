"""
Cypher language parser
   - clear logical separation between lexing/parsing still missing
   - e_XXX class object should be considered internal
"""
import re

#
# Tokens
#
tok_set__quote = ['`', '\'']

#
# Expressions
#
class e_abs(object):
    """
    Abstract expression
    """
    def __init__(self): pass

class e_keyword(e_abs):

    def __init__(self, keyword):
        super(e_keyword, self).__init__()
        self.keyword = keyword

    def __str__(self): return self.keyword

class e_value(e_abs):

    def __init__(self):
        super(e_value, self).__init__()

    @classmethod
    def rgx(self, g_name='value'):
        return '(?P<%s>[\w\d]+)' % (g_name)

class e_identifier(e_abs):

    def __init__(self):
        super(e_identifier, self).__init__()

    @classmethod
    def rgx(self, g_name='ident'):
        return '(?P<%s>[\w_]+)' % (g_name)

#
# Parse Tree
#
class pt_abs_node(object):
    """
    Abstract parse tree node
    """
    def __init__(self):
        self.sub_exp_set = []
        self.id = None
        self.parent = None

    def to_tree_str(self):
        return '\n'.join(self.__to_tree_line_arr_rec(0))

    def __to_tree_line_arr_rec(self, depth):
        ret = ['%s%s' % (('.' + 2 * ' ') * depth, str(self))]
        for e in self.sub_exp_set:
            if isinstance(e, e_abs):
                ret += ['%s' % (e)]
            else:
                ret += (e.__to_tree_line_arr_rec(depth + 1))
        return ret

    def spawn_child(self, lex_token_type):
        """
        Spawn child node:
           - set child's parent ref. to this object
           - add child node as sub exp.
        """
        child_node = lex_token_type()
        child_node.parent = self
        self.sub_exp_set.append(child_node)
        return child_node
#
# Cypher patterns
#
class pt_root(pt_abs_node):

    def __init__(self):
        super(pt_root, self).__init__()

    def clause_set_by_kw(self, keyword):
        """
        select query clause set by keyword: eg. 'create' -> [pattern__cypher_clause, ...]
        """
        ret = []
        for e in self.sub_exp_set():
            if e.__class__ != pattern__cypher_clause:
                continue
            if e.keyword == keyword:
                ret += e
        return ret

    def __str__(self): return 'root'

class pattern__node(pt_abs_node):  # node pattern: '(...)'

    def __init__(self):
        super(pattern__node, self).__init__()
        self.label_set = []

    def __str__(self):
        return '(%s%s)' % (self.id if self.id else '',
                           ':' + ':'.join(self.label_set) if len(self.label_set) > 0 else '')

    @classmethod
    def rgx(self, g_name): return '\((?P<%s>.*?)\)' % (g_name)

class pattern__rel(pt_abs_node):  # rel pattern: '[...]'

    def __init__(self):
        super(pattern__rel, self).__init__()
        self.type = None

    def __str__(self):
        return '-[%s%s]-' % (self.id if self.id else '',
                           ':' + self.type if self.type else '')

    @classmethod
    def rgx(self, g_name): return '-\[(?P<%s>.*?)\]->?' % (g_name)

class pattern__path(pt_abs_node):  # path pattern: '()-[]-()'

    def __init__(self):
        super(pattern__path, self).__init__()
        self.n_src = None
        self.rel = None
        self.n_dst = None

    def __str__(self): return '()-[]-()'

class pattern__cypher_clause(pt_abs_node):

    def __init__(self):
        super(pattern__cypher_clause, self).__init__()
        self.keyword = None

    def __str__(self): return self.keyword

class pattern__attr_set(pt_abs_node):  # attr-set pattern: {k:v, ...}

    def __init__(self):
        super(pattern__attr_set, self).__init__()
        self.key_val_dict = {}

    def __str__(self): return '{%s}' % (self.id if self.id else ', '.join(['%s: %s' % (k, v) for k, v in self.key_val_dict.items()]))

class Cypher_Parser(object):
    """
    Neo4J Cypher language parser
    """

    def parse_expression(self, input):
        """
        @return: Cypher parse tree
        """
        parent_node = pt_root()
        self.__parse(input, parent_node)
        return parent_node

    def __parse(self, input, cur_node, lex_tok_type=None):

        def rgx__suffix():  # suffix regular expression, '$' terminated
            return '(?P<suffix>.*)$'

        if None == input or 0 == len(input):  # end of input or opt regex group not found
            return

        if input[0] in tok_set__quote:  # handle various types of quotation
            quote_tok = input[0]
            rgx_quote = r'^%s(?P<quoted_exp>.+?)%s%s' % (quote_tok, quote_tok, rgx__suffix())
            m = re.match(rgx_quote, input)
            self.__parse(m.group('quoted_exp'), cur_node, e_value)
            self.__parse(m.group('suffix'), cur_node)
            return

        if ' ' == input[0]:  # consume
            self.__parse(input[1:], cur_node)
            return

        if lex_tok_type == e_identifier:
            cur_node.id = input
            return

        if lex_tok_type == e_value:
            rgx_value = r'^%s%s' % (e_value.rgx(), rgx__suffix())
            m = re.match(rgx_value, input)
            val = m.group('value')
            p_node_type = cur_node.__class__
            if p_node_type == pattern__rel:
                cur_node.type = val
            if p_node_type == pattern__node:
                cur_node.label_set.append(val)

            self.__parse(m.group('suffix'), cur_node)  # handle label sets: A:B:...
            return

        for kw in ['create', 'match']:  # handle keywords
            if input.startswith(kw):
                cur_node = cur_node.spawn_child(pattern__cypher_clause)
                cur_node.keyword = kw
                self.__parse(input[len(kw):], cur_node)
                return

        if ':' == input[0]:
            self.__parse(input[1:], cur_node, e_value)
            return

        if ',' == input[0]:  # open sibling
            self.__parse(input[1:], cur_node.parent)
            return

        if '{' == input[0]: # open param or attr-set
            cur_node = cur_node.spawn_child(pattern__attr_set)
            rgx_attr_set_or_param = r'^((%s:)|(%s))%s' % (e_identifier.rgx('ident_attr_set'),
                                                          e_identifier.rgx('ident_param'),
                                                          rgx__suffix())
            m = re.match(rgx_attr_set_or_param, input[1:])
            if m.group('ident_param'):
                self.__parse(m.group('ident_param'), cur_node, e_identifier)
                self.__parse(m.group('suffix'), cur_node)
                return
            if m.group('ident_attr_set'):
                self.__parse(input[1:], cur_node)
                return

            assert False, 'failed parsing attr_set or identifier, input: %s' % (input)

        if '(' == input[0]:  # open node or path

            if cur_node.__class__ == pattern__path:
                cur_node = cur_node.spawn_child(pattern__node)
                self.__parse(input[1:], cur_node)
                return

            rgx_path = r'^%s%s%s' % (pattern__node.rgx('src'),
                                     pattern__rel.rgx('rel'),
                                     pattern__node.rgx('dst'))

            m = re.match(rgx_path, input)
            if m:
                cur_node = cur_node.spawn_child(pattern__path)
                self.__parse(input, cur_node)
                return

            cur_node = cur_node.spawn_child(pattern__node)
            self.__parse(input[1:], cur_node)
            return

        if input.startswith('-['):  # open rel
            cur_node = cur_node.spawn_child(pattern__rel)
            self.__parse(input[2:], cur_node)
            return

        if ')' == input[0]:  # close node or path
            self.__parse(input[1:], cur_node.parent)


        if input.startswith(']-'):  # close rel
            if input.startswith(']->'):  # close directional-rel
                self.__parse(input[3:], cur_node.parent)
                return

            self.__parse(input[2:], cur_node.parent)
            return

        if '}' == input[0]:  # close attr set
            self.__parse(input[1:], cur_node.parent)
            return

        if cur_node.__class__ == pattern__attr_set: # key-value pair
            rgx_kv_pair = r'^%s:\s?((%s)|(\'%s\'))%s' % (e_identifier.rgx(),
                                                         e_value.rgx('val'),
                                                         e_value.rgx('qval'), # quoted
                                                         rgx__suffix())
            m = re.match(rgx_kv_pair, input)
            key = m.group('ident')
            val = m.group('val') if m.group('val') else m.group('qval')
            cur_node.key_val_dict[key] = val
            self.__parse(m.group('suffix'), cur_node)
            return

        if cur_node.__class__ in [pattern__rel, pattern__node]:  # node or rel

            rgx_opt_id = r'^%s%s' % (e_identifier.rgx('ident'), rgx__suffix())
            m = re.match(rgx_opt_id, input)
            if m:
                self.__parse(m.group('ident'), cur_node, e_identifier)
                self.__parse(m.group('suffix'), cur_node)
                return

            rgx_opt_lable_set = r'^:%s%s' % (e_value.rgx(), rgx__suffix())
            m = re.match(rgx_opt_lable_set, input)
            if m:
                self.__parse(m.group('value'), cur_node, e_value)
                self.__parse(m.group('suffix'), cur_node)
                return

            rgx_opt_attr_set = r'^(?P<attr_set_or_ident>\{.+?\})%s' % (rgx__suffix())
            m = re.match(rgx_opt_attr_set, input)
            if m:
                self.__parse(m.group('attr_set_or_ident'), cur_node)
                self.__parse(m.group('suffix'), cur_node)
                return
