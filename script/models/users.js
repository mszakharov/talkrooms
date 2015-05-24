/* Users cache */
Room.users = (function() {

    var online = new Collection({
        index: 'socket_id',
        order: 'nickname'
    });

    function isOnline(socket) {
        return socket.online !== 0;
    }

    function getSockets() {
        return Rest.sockets.get({room_id: Room.data.room_id}).done(update);
    }

    function update(sockets) {
        online.raw = sockets;
        online.sort();
        apply();
    }

    function apply() {
        Room.trigger('users.updated', online);
    }

    function addSocket(socket) {
        if (!online.get(socket.socket_id)) {
            online.add(socket);
            apply();
        }
    }

    function removeSocket(socket) {
        online.remove(socket.socket_id);
        apply();
    }

    Room.on('socket.created', addSocket);
    Room.on('socket.deleted', removeSocket);

    Room.on('socket.online', function(socket) {
        online.get(socket.socket_id).online = 1;
        apply();
    });

    Room.on('socket.offline', function(socket) {
        online.get(socket.socket_id).online = 0;
        apply();
    });

    Room.on('socket.nickname.updated', function(updated) {
        online.get(updated.socket_id).nickname = updated.nickname;
        online.sort();
        apply();
    });

    return {
        load: getSockets
    };

})();
