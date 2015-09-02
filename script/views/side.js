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
    var render = $.template('#user-template');

    function renderUser(data) {
        var user = render(data);
        if (data.status) {
            user.find('.nickname').append(' <em>' + data.status +'</em>');
        }
        if (data.socket_id === Room.socket.socket_id) {
            user.addClass('me');
        }
        return user[0];
    }

    Room.on('users.updated', function(online, ignore) {
        list.html('');
        list.append(online.map(renderUser));
        if (ignore.length) {
            $('<div class="users-ignored"></div>').append(ignore.map(renderUser)).appendTo(list);
        }
    });

    Room.on('ready', function() {
        list.fadeIn(150);
    });

    Room.on('leave', function() {
        list.hide();
    });

    function getSocket(elem) {
        return Room.users.get(Number(elem.attr('data-socket')));
    }

    list.on('click', '.me, .userpic', function(event) {
        event.stopPropagation();
        var elem = $(this).closest('.user');
        if (elem.hasClass('me')) {
            Profile.edit(elem);
            $('#my-nickname').select();
        } else {
            Profile.show(getSocket(elem), elem);
        }
    });

    list.on('click', '.user:not(.me) .nickname', function() {
        var user = $(this).closest('.user');
        Room.replyTo(getSocket(user).nickname);
    });

})();

// Find another room
(function() {

    var overlay = $('.room-entry');
    var back = overlay.find('.entry-back');

    function changeRoom(data) {
        Router.navigate(data.hash);
    }

    function searchRoom() {
        back.closest('.entry-text').hide();
        Rest.rooms
            .create('search')
            .done(changeRoom)
            .fail(searchFailed);
    }

    function searchFailed() {
        Room.leave();
        overlay.find('.search-failed').show().siblings().hide();
    }

    $('.actions-search .action-link').on('click', searchRoom);

    overlay.find('.entry-search').on('click', searchRoom);

    Room.on('enter', function() {
        back.attr('data-hash', Room.data.hash);
        back.parent().show();
    });

    Room.on('lost', function() {
        back.parent().hide();
    });

    back.on('click', function() {
        back.closest('.entry-text').hide();
        Room.enter(back.attr('data-hash'));
    });

})();

// Create room
(function() {

    var create = $('.actions-create');

    function changeRoom(data) {
        Router.navigate(data.hash);
    }

    create.find('.action-link').on('click', function() {
        Rest.rooms
            .create()
            .done(changeRoom);
    });

    Room.on('enter', function(socket) {
        if (socket.user_id) {
            create.slideDown(150);
        } else {
            create.hide();
        }
    });

})();

// Toggle side
(function() {

    var room = $('#room');
    var talk = $('#talk');
    var reply = $('.talk-reply textarea');

    var tapEvent = 'touchstart' in window ? 'touchend' : 'click';

    function showSide() {
        room.addClass('with-side');
        talk.on(tapEvent, hideSide);
        reply.on('focus', hideSide);
    }

    function hideSide() {
        room.removeClass('with-side');
        talk.off(tapEvent, hideSide);
        reply.off('focus', hideSide);
    }

    $('.toggle-side').on(tapEvent, function(event) {
        event.stopPropagation();
        if (room.hasClass('with-side')) {
            hideSide();
        } else {
            showSide();
        }
    });

})();
