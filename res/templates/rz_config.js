define(function() {

    return {
        'rand_id_generator' : 'hash',
        'rz_server_host': '{{ hostname }}',
        'rz_server_port': '{{ port }}',
        'backend_enabled': true,
        'backend__maintain_ws_connection': true,
        'feedback_url': '/feedback',
    };
});
