import uuid

def rand_id():
    return str(uuid.uuid4())

def flush_db(db_ctl):
    """
    complete DB flush: remove all nodes & links
    """
    db_ctl.exec_cypher_query('match (n) optional match (n)-[r]-() delete n,r')
