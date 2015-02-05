"use strict"

function submit_login_form() {
    var data = {
        email_address : $('#login_email_address').val(),
        password : $('#login_password').val()
    };

    // TODO: validate

    $.ajax({
        type : "POST",
        url: '/login',
        async : false,
        cache : false,
        data : JSON.stringify(data),
        dataType : 'json',
        contentType : "application/json; charset=utf-8",
        success : function () {
            document.location = "/index";
        },
        error : function (xhr, status, err_thrown) {
            $('#failed-login').show();
        }
    });
}
