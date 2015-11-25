// REST shortcuts
var Rest = {
    rooms:    $.Rest('/api/rooms'),
    users:    $.Rest('/api/users'),
    roles:    $.Rest('/api/roles'),
    sockets:  $.Rest('/api/sockets'),
    requests: $.Rest('/api/requests'),
    sessions: $.Rest('/api/sessions'),
    messages: $.Rest('/api/messages')
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

    $window.on('popstate', checkUrl);

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

    $(checkUrl);

    window.Router = Router;

})();

Router.on(/^$/, function(hash) {
    console.log('Hall');
});

Router.on(/^[\w\-+]{3,}$/, function(hash) {
    Room.enter(hash);
});

// Me
var Me = {};

// Get my session
Me.ready = Rest.sessions.create('me').done(function(data) {
    Me.authorized = Boolean(data.user_id);
});
