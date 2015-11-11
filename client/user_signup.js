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

function signup_form__submit() {

    function validate_data(data) {
        if (data.password_first != data.password_second) { // FIXME call util.validate...
            throw { message: 'Passwords do not match' };
        }
        if (undefined == data.password_first || data.password_first.length < 8) { // FIXME call util.validate...
            throw { message: 'Password too short - must be at least 8 charachters long' };
        }

        // TODO validate email
        return true;
    }

    var form_data = {
        first_name : $('#signup_form__first_name').val(),
        last_name : $('#signup_form__last_name').val(),
        rz_username : $('#signup_form__rz_username').val(),
        email_address : $('#signup_form__email_address').val(),
        password_first : $('#signup_form__password_first').val(),
        password_second : $('#signup_form__password_second').val(),
    };

    var msg_row = $('#signup_form__msg_row');
    msg_row.children().remove(); // reset possible previous failures

    try { // validate_data();
        validate_data(form_data);
    } catch (e) {
        msg_row.append($('<p>' + e.message +'</p>'));
        msg_row.show();
        return;
    }

    // construct post data
    var post_data = $.extend({}, form_data, {
        pw_plaintxt: form_data.password_first // rename field
    });
    delete post_data.password_first;
    delete post_data.password_second;

    $.ajax({
         type : "POST",
         url : '/signup',
         async : false,
         cache : false,
         data : JSON.stringify(post_data),
         dataType : 'json',
         contentType : "application/json; charset=utf-8",
         success : function(data, status, xhr) {
             var msg_row = $('#signup_form__msg_row'); // reset
             msg_row.children().remove();
             msg_row.append($(xhr.responseJSON.response__html));
         },
         error : function(xhr, status, err_thrown) {
             var msg_row = $('#signup_form__msg_row'); // reset
             msg_row.children().remove();
             msg_row.append($(xhr.responseJSON.response__html));
         }
     });
}
