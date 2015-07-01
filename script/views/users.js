// Users list
(function() {

    var list = $('#room .room-users');
    var renderUser = Template($('#user-template').html());

    Room.on('users.updated', function(users) {
        list.html(users.map(renderUser).join(''));
        list.find('.user[data-socket="' + Room.socket.socket_id + '"]').addClass('me');
    });

    list.on('click', '.me, .userpic', function(event) {
        var elem = $(this).closest('.user');
        event.stopPropagation();
        Profile.show(elem.attr('data-socket'), elem);
        if (elem.hasClass('me')) {
            $('#my-nickname').select();
        }
    });

    list.on('click', '.user:not(.me) .nickname', function() {
        Room.replyTo($(this).text());
    });

    // Set padding to ignore scrollbar width
    $('#side .side-scrollable')
        .css('padding-right', list.width() + 74 - $('#side').width());

})();

