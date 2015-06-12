// Users list
(function() {

    var list = $('#room .room-users');
    var renderUser = Template($('#user-template').html());

    Room.on('users.updated', function(users) {
        list.html(users.map(renderUser).join(''));
        list.find('.user[data-socket="' + Room.socket.socket_id + '"]').addClass('me');
    });

    list.on('click', '.me', function(event) {
        event.stopPropagation();
        Room.profile.show(this);
    });

    list.on('click', '.user:not(.me) .nickname', function() {
        Room.replyTo($(this).text());
    });

    // Set padding to ignore scrollbar width
    $('#side .side-scrollable')
        .css('padding-right', list.width() + 45 - $('#side').width());

})();

// Profile
(function() {

    var field = $('#profile-nickname');
    var popup = $.popup('#profile', function() {
        this.fadeIn(100);
    });

    function show(target) {
        var elem = $(target);
        popup.css('top', elem.position().top).show();
        field.val('').focus();
        field.val(elem.find('.nickname').text());
    }

    function hide() {
        popup.hide();
    }

    popup.find('form').on('submit', function(event) {
        event.preventDefault();
        var value = $.trim(field.val());
        if (value) {
            Rest.sockets.update(Room.socket.socket_id, {nickname: value}).done(hide);
        }
    });

    Room.on('ready', function(socket) {
        var logged = socket.user_id != null;
        popup.find('.profile-login').toggle(!logged);
        popup.find('.profile-logout').toggle(logged);
    });

    Room.profile = {
        show: show,
        hide: hide
    };

})();
