function Events() {

    var events = {};
    var slice = Array.prototype.slice;

    this.on = function(type, callback) {
        events[type] = [callback].concat(events[type] || []);
    };

    this.off = function(type, callback) {
        var list = events[type];
        if (list) {
            list = list.concat();
            for (var i = list.length; i--;) {
                if (list[i] === callback) list.splice(i, 1);
            }
            events[type] = list;
        }
    };

    this.trigger = function(type, data) {
        var list = events[type];
        if (list) {
            var i = list.length;
            if (arguments.length > 2) {
                var args = slice.call(arguments, 1);
                while (i--) list[i].apply(this, args);
            } else {
                // Use faster call for most common single argument
                while (i--) list[i].call(this, data);
            }
        }
    };

}

Events.mixin = function(target) {
    Events.call(target);
    return target;
};
