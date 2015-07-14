/* Ignore */
(function() {

    var myLevel = Room.myRole ? Room.myRole.level : 0;
    var section = $('#profile-ignore');

    var ignoreOn = section.find('.ignore-on'),
        ignoreOff = section.find('.ignore-off'),
        clear = section.find('.ignore-clear')

    function toggleControls(socket) {
        if (socket.ignore) showOn(); else showOff();
    }

    var selectedMessage;

    function showOn() {
        ignoreOff.hide();
        if (selectedMessage) {
            var time = selectedMessage.find('.msg-time').text();
            clear.find('.ignore-after').text(time);
            clear.show();
        } else {
            clear.hide();
        }
        ignoreOn.show();
    }

    function showOff() {
        ignoreOn.hide();
        ignoreOff.show();
    }

    function isCurrent(socket) {
        return Profile.socket && socket.socket_id === Profile.socket.socket_id;
    }

    Profile.on('show', function(socket, me) {
        if (myLevel >= 50 && !me && socket.session_id) {
            var message = Profile.target && Profile.target.closest('.message');
            selectedMessage = (message && message.length) ? message : null;
            section.children().hide();
            section.show();
        }
    });

    Profile.on('ready', function(data) {
        if (section.is(':hidden')) return;
        if (data.level && data.level >= myLevel) {
            section.find('.ignore-denied').show();
        } else {
            toggleControls(Profile.socket);
        }
        Profile.fit();
    });

    Room.on('socket.ignore.updated', function(socket) {
        if (isCurrent(socket)) toggleControls(socket);
    });

    function setIgnore(value) {
        return Rest.sessions.update(Profile.socket.session_id, {
            room_id: Room.data.room_id,
            ignore: value
        });
    }

    ignoreOff.find('.button').on('click', function() {
        setIgnore(true).done(showOn);
    });

    ignoreOn.find('.ignore-cancel').on('click', function() {
        setIgnore(false).done(showOff);
    });

    clear.on('click', function() {
        if (selectedMessage) {
            var message_id = selectedMessage.attr('data-id');
            Rest.messages.create(message_id + '/ignore_below').done(function() {
                Profile.target = null;
                clear.hide();
            });
        }
    });

})();
