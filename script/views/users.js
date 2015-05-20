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
        // Copy the nickname to the reply form
    });

})();

(function() {

    var sockets = $.Rest('/api/sockets');

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

    popup.on('submit', function(event) {
        event.preventDefault();
        var value = $.trim(field.val());
        if (value) {
            sockets.update(Room.socket.socket_id, {nickname: value}).done(hide);
        }
    });

    Room.profile = {
        show: show
    };

})();
