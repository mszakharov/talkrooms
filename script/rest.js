// REST
(function() {

    var actions = {get: 'GET', create: 'POST', update: 'PATCH', destroy: 'DELETE'};

    function Rest(path) {
        this.path = path.replace(/\/$/, '');
    }

    function isPrimitive(value) {
        return typeof value === 'string' || typeof value === 'number';
    }

    function request(method, path, params) {
        var url = [path], data;
        for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (isPrimitive(param)) {
                url.push(param)
            } else {
                data = param;
            }
        }
        return $.ajax(url.join('/'), {
            method: method,
            data: data && JSON.stringify(data)
        });
    }

    $.each(actions, function(action, method) {
        Rest.prototype[action] = function(name, data) {
            return request(method, this.path, arguments);
        };
    });

    $.Rest = function(path) {
        return new Rest(path);
    };

})();
