/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict"

define('pw_reset__common', ['jquery'], function($) {

    function present_ajax_resp__html(data) {
        var pw_reset_form__ajax_response = $('#pw_reset_form__ajax_response'); // reset
        pw_reset_form__ajax_response.children().remove();
        pw_reset_form__ajax_response.append($(data.response__html));
    };

    return { present_ajax_resp__html: present_ajax_resp__html };
});

define('pw_reset__submit_rst_req', ['jquery', 'util', 'pw_reset__common'], function($, util, pw_reset__common) {

    function pw_reset_form__submit_req() {

        var form_data = { email_address: $('#pw_reset_form__email_address').val()};
        try { // validate_data
            var msg_row = $('#msg_row'); // reset
            msg_row.children().remove();

            // TODO validate email

            msg_row.hide();
        } catch(e) {
            var msg_row = $('#msg_row');
            msg_row.append($('<p>' + e.message +'</p>'));
            msg_row.show();
            return;
        }

        function on_success(data, status, xhr) { pw_reset__common.present_ajax_resp__html(data); };
        function on_error(xhr,  status, err_thrown) { pw_reset__common.present_ajax_resp__html(err_thrown); }
        util.form_common__rest_post('/pw-reset', form_data, on_success, on_error);
    }

    window.pw_reset_form__submit = pw_reset_form__submit_req;
    return {};
});

define('pw_reset__submit_new_pw', ['jquery', 'util', 'pw_reset__common'], function($, util, pw_reset__common) {

    function pw_reset_form__submit_new_pw() {

        try { // validate_data();
            var msg_row = $('#msg_row'); // reset
            msg_row.children().remove();

            util.input_validation__password($('#pw_reset_form__password_first').val(),
                                            $('#pw_reset_form__password_second').val());

            msg_row.hide();
        } catch(e) {
            var msg_row = $('#msg_row');
            msg_row.append($('<p>' + e.message +'</p>'));
            msg_row.show();
            return;
        }

        // resend token along with request
        var url_param_str = location.search.substring(1) // all url params after '?'
        var url_param_arr = url_param_str.split('=') // expect: [0] := token_key, [1] := token_value
        var form_data = { new_user_password: $('#pw_reset_form__password_first').val(),
                          pw_rst_tok: url_param_arr[1] };

        function on_success(data, status, xhr) { pw_reset__common.present_ajax_resp__html(data); };
        function on_error(xhr,  status, err_thrown) { pw_reset__common.present_ajax_resp__html(err_thrown); }
        util.form_common__rest_post('/pw-reset', form_data, on_success, on_error);
    }

    window.pw_reset_form__submit = pw_reset_form__submit_new_pw;
    return {};
});

