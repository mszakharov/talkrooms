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

    $(checkUrl);

    window.Router = Router;

})();

Router.on(/^$/, function(hash) {
    Hall.update();
    Room.toggle(false);
    Room.leave();
});

Router.on(/^[\w\-+]{3,}$/, function(hash) {
    Room.enter(hash);
    Room.toggle(true);
});

// Me
var Me = {};

// Get my session
(function() {

    function update(data) {
        Me.authorized = Boolean(data.user_id);
        Me.ignores = data.ignores;
        Me.checkVersion(data.talkrooms);
    }

    Me.load = function() {
        return Rest.sessions.get('me').done(update);
    };

})();

// Talkrooms vesrion
(function() {

    var notice;
    var version = 32;

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
