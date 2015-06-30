/* Users cache */
Room.users = (function() {

    var sockets = new Collection({
        index: 'socket_id',
        order: 'nickname'
    });

    function isMySocket(socket) {
        return socket.socket_id === Room.socket.socket_id;
    }

    function groupOnline(socket) {
        var uid = socket.user_id;
        if (socket.ignore && !Room.socket.ignore) return false;
        if (uid) {
            if (uid === Room.socket.user_id) {
                return isMySocket(socket);
            } else {
                return this[uid] ? false : this[uid] = socket.online;
            }
        } else {
            return socket.online !== 0;
        }
    }

    function getSockets() {
        return Rest.sockets.get({room_id: Room.data.room_id}).done(reset);
    }

    function reset(data) {
        sockets.raw = data;
        sockets.raw.forEach(setUserpicUrl);
        sockets.sort();
        apply();
    }

    function apply() {
        Room.trigger('users.updated', sockets.raw.filter(groupOnline, {}));
    }

    function setUserpicUrl(socket) {
        socket.userpicUrl = Userpics.getUrl(socket);
    }

    function addSocket(socket) {
        if (!sockets.get(socket.socket_id)) {
            sockets.add(socket);
            setUserpicUrl(socket);
            apply();
        }
    }

    function removeSocket(socket) {
        sockets.remove(socket.socket_id);
        apply();
    }

    function updateSocket(data) {
        var socket = sockets.get(data.socket_id);
        var renamed = data.nickname !== socket.nickname;
        $.extend(socket, data);
        setUserpicUrl(socket);
        if (renamed) {
            sockets.sort();
        }
        apply();
    }

    Room.on('socket.created', addSocket);
    Room.on('socket.deleted', removeSocket);

    Room.on('socket.online', function(socket) {
        sockets.get(socket.socket_id).online = 1;
        apply();
    });

    Room.on('socket.offline', function(socket) {
        sockets.get(socket.socket_id).online = 0;
        apply();
    });

    Room.on('socket.ignore.on', function(socket) {
        sockets.get(socket.socket_id).ignore = 1;
        apply();
    });

    Room.on('socket.ignore.off', function(socket) {
        sockets.get(socket.socket_id).ignore = 0;
        apply();
    });

    Room.on('socket.nickname.updated', updateSocket);
    Room.on('socket.user_id.updated', updateSocket);
    Room.on('socket.userpic.updated', updateSocket);

    return {
        load: getSockets
    };

})();
