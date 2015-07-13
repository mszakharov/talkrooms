/* Ignore */
(function() {

    var myLevel = Room.myRole ? Room.myRole.level : 0;
    var section = $('#profile-ignore');

    var ignoreOn = section.find('.ignore-on'),
        ignoreOff = section.find('.ignore-off');

    function toggleControls(socket) {
        if (socket.ignore) showOn(); else showOff();
    }

    function showOn() {
        ignoreOff.hide();
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
        if (myLevel >= 50 && !me) {
            section.children().hide();
            section.show();
        }
    });

    Profile.on('ready', function(data) {
        if (section.is(':hidden')) return;
        if (data.level && data.level >= myLevel) {
            section.find('.ignore-denied').show();
        } else if (!Profile.socket.socket_id) {
            section.find('.ignore-disabled').show();
        } else {
            toggleControls(Profile.socket);
        }
        Profile.fit();
    });

    Room.on('socket.ignore.updated', function(socket) {
        if (isCurrent(socket)) toggleControls(socket);
    });

    function setIgnore(value) {
        return Rest.sockets.update(Profile.socket.socket_id, {ignore: value});
    }

    ignoreOff.find('button').on('click', function() {
        setIgnore(true).done(showOn);
    });

    ignoreOn.find('button').on('click', function() {
        setIgnore(false).done(showOff);
    });

})();
