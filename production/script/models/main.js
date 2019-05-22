// REST shortcuts
var Rest = {
    rooms:    $.Rest('/api/rooms'),
    users:    $.Rest('/api/users'),
    roles:    $.Rest('/api/roles'),
    sockets:  $.Rest('/api/sockets'),
    requests: $.Rest('/api/requests'),
    sessions: $.Rest('/api/sessions'),
    messages: $.Rest('/api/messages'),
    subscriptions: $.Rest('/api/subscriptions')
};

// Router
(function() {

    var Router = {};
    var routes = [];

    var history = window.history;

    function checkUrl() {
        var hash = location.hash.replace(/^#/, '');
        if (hash !== Router.hash) {
            Router.hash = hash;
            processHash(hash);
        }
    }

    function processHash(hash) {
        for (var i = 0; i < routes.length; i++) {
            var match = routes[i].route.test(hash);
            if (match) {
                return routes[i].callback(hash);
            }
        }
    }

    $window.on('popstate hashchange', checkUrl);

    Router.on = function(route, callback) {
        routes.push({route: route, callback: callback});
    };

    Router.push = function(hash, title) {
        history.pushState({}, title || '', '#' + hash);
        checkUrl();
    };

    Router.replace = function(hash, title) {
        history.replaceState({}, title || document.title, '#' + hash);
    };

    $(function() {
        var redirect = sessionStorage.getItem('redirect');
        if (redirect) {
            sessionStorage.removeItem('redirect');
            if (redirect !== location.hash.replace(/^#/, '')) {
                Router.replace(redirect);
            }
        }
        checkUrl();
    });

    window.Router = Router;

})();

Router.on(/^$/, function(hash) {
    Rooms.leave();
});

Router.on(/^\+$/, function() {
    Rooms.enter();
    Rooms.explore();
});

Router.on(/^[\w\-+]{3,}$/, function(hash) {
    Rooms.enter();
    Rooms.select(hash);
});

// Redirect after login
$('.login-links').on('click', 'a', function() {
    if (Router.hash) {
        sessionStorage.setItem('redirect', Router.hash);
    }
});

// My session
var Me = new Events();

// Get my session
(function() {

    function update(data) {
        Me.rand_nickname = Boolean(data.rand_nickname);
        Me.authorized = Boolean(data.user_id);
        Me.provider_id = data.provider_id;
        Me.ignores = data.ignores;
        Me.subscriptions = data.subscriptions;
        Me.checkVersion(data.talkrooms);
        updateRooms(data);
    }

    function updateRooms(data) {
        Me.rooms = data.rooms || [];
        Me.recent_rooms = data.recent_rooms || [];
    }

    Me.fetch = function() {
        return this.ready = Rest.sessions.get('me').done(update);
    };

})();

// Ignores
Me.isHidden = function(data) {
    return Boolean(data.user_id ?
        Me.ignores[0][data.user_id] :
        Me.ignores[1][data.session_id]);
};

// Talkrooms vesrion
(function() {

    var notice;
    var version = 39;

    function showNotice(description) {
        notice = $('<div class="updated-notice"></div>')
            .append('<div class="updated-title">Вышло обновление Talkrooms. Пожалуйста, <span class="updated-reload">обновите страницу</span>, чтобы сбросить кэш браузера.</div>')
            .append('<div class="updated-text">' + description + '</div>');
        notice.find('.updated-reload').on('click', function() {
            location.reload(true);
        });
        notice.appendTo('body')
            .css('top', -notice.outerHeight() - 20)
            .animate({top: 0}, 300);
    }

    Me.checkVersion = function(data) {
        if (data && data.version > version && !notice) showNotice(data.whatsnew);
    };

})();

// Socket
(function() {

    var Socket = Events.mixin({});

    var path = String.mix('wss://$1/sockets/', window.location.host),
        stream,
        token;

    var connectionTimer,
        connectionTries = 0,
        closedInstantly = 0;

    function getConnectionDelay(tries) {
        if (tries > 6) return 60;
        if (tries > 0) return 10;
        return 1;
    }

    function openSocket() {
        connectionTries = 0;
        if (window.WebSocket && WebSocket.CLOSED === 3) {
            stream = new WebSocket(path + token);
            stream.addEventListener('open', onOpen);
            stream.addEventListener('message', onMessage);
            stream.addEventListener('close', onClose);
        }
    }

    function disconnect() {
        clearTimeout(connectionTimer);
        if (stream) {
            stream.removeEventListener('open', onOpen);
            stream.removeEventListener('message', onMessage);
            stream.removeEventListener('close', onClose);
            stream.close();
        }
        stream = null;
    }

    function reconnect() {
        clearTimeout(connectionTimer);
        Rest.sockets.get(Socket.id)
            .then(openSocket)
            .catch(socketLost);
    }

    function socketLost(xhr) {
        if (xhr.status == 404) {
            Socket.id = null;
            Socket.trigger('lost');
        } else {
            connectLater();
        }
    }

    function connectLater() {
        var tries = connectionTries++;
        var delay = closedInstantly > 1 ? getConnectionDelay(tries) : 5;
        connectionTimer = setTimeout(reconnect, delay * 1000);
    }

    function socketCreated(socket) {
        token = socket.token;
        Socket.id = socket.socket_id;
        Socket.trigger('created');
        openSocket();
    }

    function onOpen() {
        closedInstantly = 0;
        Socket.connected = true;
        Socket.trigger('connected');
    }

    function onClose(event) {
        Socket.connected = false;
        Socket.trigger('disconnected');
        if (closedInstantly++ > 5) {
            disconnect();
        } else if (event.code !== 1000) {
            connectLater();
        }
    }

    function onMessage(message) {
        var event = JSON.parse(message.data);
        Socket.trigger(event[0], event[1]);
    }

    Socket.create = function() {
        return Rest.sockets.create()
            .then(socketCreated);
    };

    $window.on('beforeunload', disconnect);

    window.Socket = Socket;

})();

// Get session and create socket
(function() {

    var errors = {
        406: 'Пожалуйста, включите куки в&nbsp;вашем браузере',
        402: 'Слишком много одновременных соединений',
        500: 'Ведутся технические работы'
    };

    function prepare(saveSelected) {
        Me.fetch()
            .then(Socket.create)
            .then(function() {
                Rooms.reset(Me.subscriptions, saveSelected);
            })
            .catch(showError);
    }

    function showError(xhr) {
        $('<div class="fatal-error"></div>')
            .html(xhr.status && errors[xhr.status] || errors[500])
            .appendTo('body');
    }

    // when the page loads
    prepare(true);

    // if socket has expired
    Socket.on('lost', function() {
        prepare();
    });

})();


// Debug socket events
(function() {

    if (localStorage.getItem('debug')) {

        var _trigger = Socket.trigger;

        Socket.trigger = function(name, data) {
            console.log(name, data);
            _trigger.call(Socket, name, data);
        };

    }

})();


// Login in other tab
Socket.on('me.user_id.updated', function() {
    Me.authorized = true;
    Me.reload(); // update rooms and ignores
});

// Logout in other tab
Socket.on('me.deleted', function() {
    Me.authorized = false;
    if (Router.hash) {
        Router.push('');
    }
});

// Update rooms
Socket.on('me.recent_rooms.updated', function(data) {
    Me.recent_rooms = data.recent_rooms || [];
});
Socket.on('me.rooms.updated', function(data) {
    Me.rooms = data.rooms || [];
});

// Update ignores
Socket.on('me.ignores.updated', function(data) {
    Me.ignores = data.ignores;
    Me.trigger('ignores.updated');
});

