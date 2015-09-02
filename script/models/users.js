/* Users cache */
Room.users = (function() {

    var sockets = new Collection({
        index: 'socket_id',
        order: 'normal_nickname'
    });

    var showIgnored;

    function groupOnline(sockets, mySocketId) {
        var grouped = [];
        var indexes = {};
        for (var i = 0; i < sockets.length; i++) {
            var socket = sockets[i];
            if (socket.online) {
                var digest = socket.user_id || socket.nickname;
                if (indexes[digest] === undefined) {
                    indexes[digest] = grouped.push(socket) - 1;
                } else if (socket.socket_id === mySocketId) {
                    grouped[indexes[digest]] = socket;
                }
            }
        }
        return grouped;
    }

    function notIgnored(socket) {
        var ignored = socket.ignored && !Room.socket.ignored;
        if (ignored && showIgnored) this.push(socket);
        return !ignored;
    }

    function apply() {
        var ignore = [];
        var online = groupOnline(sockets.raw, Room.socket.socket_id);
        Room.trigger('users.updated', online.filter(notIgnored, ignore), ignore);
    }

    function getSockets() {
        return Rest.sockets.get({room_id: Room.data.room_id}).done(reset);
    }

    function reset(data) {
        sockets.raw = data;
        sockets.raw.forEach(setUserpicUrl);
        sockets.raw.forEach(normalizeNickname);
        sockets.sort();
        apply();
    }

    function setUserpicUrl(socket) {
        socket.userpicUrl = Userpics.getUrl(socket);
    }

    function normalizeNickname(socket) {
        var lower = socket.nickname.toLowerCase();
        var pure = lower.replace(/[^\wа-яё]/g, '');
        socket.normal_nickname = lower === pure ? lower : pure + socket.nickname;
    }

    function addSocket(socket) {
        if (!sockets.get(socket.socket_id)) {
            normalizeNickname(socket);
            setUserpicUrl(socket);
            sockets.add(socket);
            apply();
        }
    }

    function removeSocket(socket) {
        sockets.remove(socket.socket_id);
        apply();
    }

    Room.on('enter', function(socket) {
        showIgnored = socket.level ? socket.level >= 50 : false;
        this.promises.push(getSockets());
    });

    Room.on('socket.created', addSocket);
    Room.on('socket.deleted', removeSocket);

    Room.on('session.ignored.updated', function(session) {
        var sid = session.session_id;
        sockets.raw.forEach(function(socket) {
            if (socket.session_id === sid) socket.ignored = session.ignored;
        });
        apply();
    });

    function patchUser(user_id, callback) {
        sockets.raw.forEach(function(socket) {
            if (socket.user_id === user_id) callback(socket);
        });
    }

    Room.on('user.userpic.updated', function(user) {
        patchUser(user.user_id, function(socket) {
            socket.userpic = user.userpic;
            setUserpicUrl(socket);
        });
        apply();
    });

    Room.on('user.photo.updated', function(user) {
        patchUser(user.user_id, function(socket) {
            socket.photo = user.photo;
        });
    });

    Room.on('socket.nickname.updated', function(data) {
        var socket = sockets.get(data.socket_id);
        socket.nickname = data.nickname;
        normalizeNickname(socket);
        sockets.sort();
        if (!socket.userpic) {
            setUserpicUrl(socket);
        }
        apply();
    });

    Room.on('socket.online.updated', function(data) {
        sockets.get(data.socket_id).online = data.online;
        apply();
    });

    Room.on('socket.status.updated', function(data) {
        sockets.get(data.socket_id).status = data.status;
        apply();
    });

    return {
        get: function(socket_id) {
            return sockets.get(socket_id)
        },
        findSession: function(session_id) {
            return sockets.raw.filter(function(socket) {
                return socket.session_id === session_id;
            });
        }
    };

})();
