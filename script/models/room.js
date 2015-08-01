// REST shortcuts
var Rest = {
    rooms:    $.Rest('/api/rooms'),
    roles:    $.Rest('/api/roles'),
    sockets:  $.Rest('/api/sockets'),
    sessions: $.Rest('/api/sessions'),
    messages: $.Rest('/api/messages')
};

// Room
var Room = new Events;

// Enter a room
(function() {

    function admit(data) {
        Room.id = data.room_id;
        Room.data = data;
        Rest.sockets.create({hash: data.hash}).done(ready);
    }

    function ready(socket) {
        Room.promises = [];
        Room.socket = socket;
        Room.trigger('enter', socket);
        $.when.apply($, Room.promises).done(function() {
            Room.trigger('ready');
        });
    }

    function stop(xhr) {
        Room.trigger('lost');
    }

    Room.enter = function(hash) {
        Room.hash = hash;
        Rest.rooms.get(hash).done(admit).fail(stop);
    };

    Room.leave = function() {
        Room.trigger('leave');
        Rest.sockets.destroy(Room.socket.socket_id);
        Room.socket = null;
        Room.data = null;
        Room.hash = null;
        Room.id = null;
    };

    $window.on('beforeunload', function(event) {
        if (Room.socket) Room.leave();
    });

})();

// Compare user, session and socket id with my socket
Room.isMy = function(data) {
    var my = this.socket;
    return my &&
        my.socket_id === data.socket_id ||
        my.session_id === data.session_id ||
        my.user_id && my.user_id === data.user_id;
};

// Socket
(function() {

    var path = String.mix('wss://$1/sockets/', window.location.host);

    function onOpen() {
        Room.trigger('connected');
    }

    function onClose(event) {
        console.log('Close socket', event.code);
        Room.trigger('disconnected');
        if (event.code !== 1000 && Room.socket) {
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

    if (window.WebSocket && WebSocket.CLOSED === 3) {
        Room.on('ready', connect);
    }

})();

// Update room
(function() {

    function patch(data) {
        $.extend(Room.data, data);
    }

    Room.on('room.hash.updated', function(data) {
        Room.hash = data.hash;
    });

    Room.on('room.topic.updated', patch);
    Room.on('room.hash.updated', patch);
    Room.on('room.searchable.updated', patch);

})();

// Ignore
Room.on('session.ignore.updated', function(session) {
    if (Room.socket.session_id === session.session_id) Room.socket.ignore = session.ignore;
});

// Update my nickname
Room.on('socket.nickname.updated', function(socket) {
    if (Room.socket.socket_id === socket.socket_id) {
        Room.socket.nickname = socket.nickname;
        Room.trigger('my.nickname.updated', socket);
    }
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

// Router
(function() {

    var history = window.history;
    var defaultHash = 'chat30';

    function checkUrl() {
        var hash = location.hash.replace(/^#/, '');
        if (hash !== Room.hash && Room.socket) {
            Room.leave();
        }
        if (hash) {
            Room.enter(hash);
        } else {
            replaceState(defaultHash);
            Room.enter(defaultHash);
        }
    }

    function replaceState(hash, title) {
        history.replaceState({}, title || document.title, '#' + hash);
    }

    Room.on('room.hash.updated', function(data) {
        replaceState(data.hash, Room.data.topic);
    });

    $window.on('popstate', checkUrl);

    $(checkUrl);

    window.Router = {
        navigate: function(hash, title) {
            history.pushState({}, title || '', '#' + hash);
            checkUrl();
        }
    };

})();

