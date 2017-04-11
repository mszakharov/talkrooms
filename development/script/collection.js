// Collection
(function() {

    function Collection(options) {
        var opts = options || {};
        this.index = opts.index || 'id';
        this.order = opts.order && compile(opts.order, Comparator);
        this.raw = [];
    }

    function compile(source, compiler) {
        return typeof source === 'function' ? source : compiler(source);
    }

    function Property(key) {
        return function(item) { return item[key]; };
    }

    function Comparator(key) {
        return function(a, b) {
            if (a[key] > b[key]) return  1;
            if (a[key] < b[key]) return -1;
            return 0;
        }
    }

    Collection.prototype = {

        map: function(iterator) {
            return this.raw.map(compile(iterator, Property));
        },

        add: function(item) {
            this.raw.push(item);
            if (this.order) {
                this.sort();
            }
        },

        remove: function(id) {
            var removed;
            var key = this.index;
            this.raw = this.raw.filter(function(item) {
                return !(item[key] == id && (removed = item));
            });
            return removed;
        },

        get: function(id) {
            var raw = this.raw;
            var key = this.index;
            for (var i = 0; i < raw.length; i++) {
                if (raw[i][key] == id) return raw[i];
            }
        },

        sort: function() {
            this.raw.sort(this.order);
        }

    };

    window.Collection = Collection;

})();
