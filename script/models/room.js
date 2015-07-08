// REST shortcuts
var Rest = {
    rooms:    $.Rest('/api/rooms'),
    roles:    $.Rest('/api/roles'),
    sockets:  $.Rest('/api/sockets'),
    messages: $.Rest('/api/messages')
};

// Room
var Room = new Events;

// Enter a room
(function() {

    function admit(data) {
        Room.data = data;
        Rest.sockets.create({hash: data.hash}).done(ready);
    }

    function ready(socket) {
        Room.promises = [];
        Room.socket = socket;
        Room.trigger('enter');
        if (socket.user_id) {
            Room.promises.push(getRole(socket).done(updateRole));
        } else {
            updateRole(null);
        }
        $.when.apply($, Room.promises).done(function() {
            Room.trigger('ready');
        });
    }

    function stop(xhr) {
        Room.trigger('lost');
    }

    function getRole(socket) {
        return Rest.roles.get(Room.data.room_id + '/' + socket.user_id);
    }

    function updateRole(role) {
        Room.myRole = role;
        Room.trigger('role.updated', role);
    }

    Room.enter = function(hash) {
        Rest.rooms.get(hash).done(admit).fail(stop);
    };

    Room.leave = function() {
        Rest.sockets.destroy(Room.socket.socket_id);
        Room.trigger('leave');
    };

    $window.on('beforeunload', function(event) {
        if (Room.socket) Room.leave();
    });

})();

// Socket
(function() {

    var path = String.mix('wss://$1/sockets/', window.location.host);

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
        Rest.sockets
            .get(Room.socket.socket_id)
            .done(connect)
            .fail(reconnectFailed);
    }

    function reconnectFailed(xhr) {
        if (xhr.status == 404) {
            Room.enter(Room.data.hash);
        } else {
            setTimeout(reconnect, 10000);
        }
    }

    function connect() {
        var ws = new WebSocket(path + Room.socket.token);
        ws.addEventListener('open', onOpen);
        ws.addEventListener('message', onMessage);
        ws.addEventListener('close', onClose);
    }

    if ('WebSocket' in window) {
        Room.on('ready', connect);
    }

})();

// Ignore
Room.on('socket.ignore.updated', function(socket) {
    if (Room.socket.socket_id === socket.socket_id) Room.socket.ignore = socket.ignore;
});

// Inactive window detection
(function() {

    $window.on('blur', function() {
        Room.idle = true;
    });

    $window.on('focus', function() {
        Room.idle = false;
    });

})();

