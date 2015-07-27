// Adjust padding to scrollbar width
(function() {

    var sample = document.createElement('div');
    sample.style.width = '100px';
    sample.style.position = 'absolute';
    sample.style.overflowY = 'scroll';
    sample.style.top = '-100px';

    document.body.appendChild(sample);
    var scrollBarWidth = sample.offsetWidth - sample.clientWidth;
    document.body.removeChild(sample);

    $('#side .side-scrollable').css('padding-right', 25 - scrollBarWidth);

})();

// Users list
(function() {

    var list = $('#room .room-users');
    var renderUser = Template($('#user-template').html());

    Room.on('users.updated', function(online, ignore) {
        var content = online.map(renderUser).join('');
        if (ignore.length) {
            content += '<div class="users-ignored">' + ignore.map(renderUser).join('') + '</div>';
        }
        list.html(content);
        list.find('.user[data-socket="' + Room.socket.socket_id + '"]').addClass('me');
    });

    Room.on('ready', function() {
        list.fadeIn(150);
    });

    Room.on('leave', function() {
        list.hide();
    });

    list.on('click', '.me, .userpic', function(event) {
        event.stopPropagation();
        var elem = $(this).closest('.user');
        if (elem.hasClass('me')) {
            Profile.edit(elem);
            $('#my-nickname').select();
        } else {
            var socket_id = Number(elem.attr('data-socket'));
            Profile.show(Room.users.get(socket_id), elem);
        }
    });

    list.on('click', '.user:not(.me) .nickname', function() {
        Room.replyTo($(this).text());
    });

})();

