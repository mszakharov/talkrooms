// REST
(function() {

    var actions = {get: 'GET', create: 'POST', update: 'PATCH', destroy: 'DELETE'};

    function Rest(path) {
        this.path = path.replace(/\/$/, '');
    }

    function request(method, url, data) {
        return $.ajax(url, {
            method: method,
            data: data && JSON.stringify(data)
        });
    }

    $.each(actions, function(action, method) {
        Rest.prototype[action] = function(name, data) {
    		return typeof name === 'object' ?
                request(method, this.path, name) :
                request(method, name ? this.path + '/' + name : this.path, data);
        };
    });

    $.Rest = function(path) {
        return new Rest(path);
    };

})();
