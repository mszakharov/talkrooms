// Room
var Room = new Events;

(function() {

    var rooms = $.Rest('/api/rooms');
    var sockets = $.Rest('/api/sockets');

    function enter(data) {
        Room.data = data;
        Room.trigger('topic.updated', data.topic);
        sockets.create({hash: data.hash}).done(ready);
    }

    function ready(socket) {
        Room.socket = socket;
        $.when(Room.loadRecent(), Room.users.load()).done(function() {
            Room.trigger('ready', socket);
        });
    }

    function stop(xhr) {
        Room.trigger('notfound');
    }

    Room.reset = function(hash) {
        rooms.get(hash).done(enter).fail(stop);
    };

})();

// Socket
(function() {

    var path = String.mix('wss://$1/sockets/', window.location.host);

    var sockets = $.Rest('/api/sockets');
    var current;

    function onOpen() {
        console.log('Open socket');
        Room.trigger('connected');
    }

    function onClose(event) {
        console.log('Close socket', event.code);
        Room.trigger('disconnected');
        if (event.code !== 1000) {
            setTimeout(reconnect, 1000);
        }
    }

    function onMessage(message) {
        var event = JSON.parse(message.data);
        console.log(message.data);
        Room.trigger(event[0], event[1]);
    }

    function reconnect() {
        sockets
            .get(Room.socket.socket_id)
            .done(restore)
            .fail(reconnectFailed);
    }

    function reconnectFailed(xhr) {
        if (xhr.status == 404) {
            Room.reset(Room.data.hash);
        } else {
            setTimeout(reconnect, 10000);
        }
    }

    function connect(socket) {
        var ws = new WebSocket(path + socket.token);
        ws.addEventListener('open', onOpen);
        ws.addEventListener('message', onMessage);
        ws.addEventListener('close', onClose);
    }

    function restore() {
        connect(Room.socket);
    }

    Room.on('ready', connect);

    window.addEventListener('beforeunload', function(event) {
        if (Room.socket) sockets.destroy(Room.socket.socket_id);
    });

})();



