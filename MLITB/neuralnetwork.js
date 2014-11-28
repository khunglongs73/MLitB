var Client     = require('./client'),
    Boss       = require('./boss'),
    master     = require('./master'),
    SGDTrainer = require('./sgd'),
    mlitb = require('./static/js/mlitb');

var id = 0;

var NeuralNetwork = function(data, master) {

    this.running = false;

    this.master = master;

    id += 1;

    this.running = false;

    this.id = id; // unique identifiable
    this.slaves = []; // maps to slave nodes
    this.data = []; // data allocation array
    this.labels = []; // full collection of labels

    this.name = data.name; // verbose name

    this.slaves_connected = [];
    this.slaves_operating = []; // slaves currently at work
    this.slaves_tracking = []; // slaves tracking parameters
    this.operation_results = [];
    
    this.configuration = data.nn; // NN configuration

    this.parameters;
    this.error = 0.0;

    this.iteration_time = data.iteration_time; // time per iteration
    this.runtime_elapsed = 0; // time elapsed
    this.realtime_elapsed = 0; // real time elapsed
    this.step = 0; // nn step
    this.data_seen = 0; // data points seen

    this.SGD; // well, the SGD

    this.hyperparameters_changed = false; // needed for signaling, else continous overwrite.
    this.hyperparameters = {

        learning_rate : 0.01, //starting value of learning rate
        lr_decay : 0.999, //multiplication factor
        lr_decay_interval : 2, //iteration interval of learning rate decay
        lr_threshold : 0.00001, //0.001, //lower bound of learning rate
        momentum : 0.9,
        batch_size : 16, 
        l2_decay : 0.000, 
        l1_decay : 0.000

    }

    // fix labels for new NNs:

    for(var key in data.nn.index2label) {
        this.labels.push(data.nn.index2label[key]);
    }

    console.log('constructor '+JSON.stringify(this.labels));

    this.Net = new mlitb.Net();
    this.Net.setConfigsAndParams(this.configuration);
    
    this.SGD = new SGDTrainer(this, {});
    this.SGD.set_parameters(this.hyperparameters);
}

NeuralNetwork.prototype = {

    list: function() {
        return {
            id: this.id,
            name: this.name,
            slaves: this.slaves.length,
            slaves_connected: this.slaves_connected.length,
            data: this.data.length,
            iteration_time: this.iteration_time,
            runtime_elapsed: this.runtime_elapsed,
            realtime_elapsed: this.realtime_elapsed,
            step: this.step,
            data_seen: this.data_seen,
            error: this.error.toFixed(6),
            hyperparameters: this.hyperparameters,
            running: this.running,
            configuration: this.configuration.configs
        }
    },

    download: function() {

        // return this.configuration;
        // use the latest state of configs and params
        return this.Net.getConfigsAndParams();

    },

    add_data: function(socket, ids, labels) {

        var i = ids.length;
        while(i--) {

            var new_point = {
                id: ids[i],
                assigned: [],
                cache: [],
                process: []
            }

            this.data.push(new_point);

        }

        var i = labels.length;
        var new_labels = [];

        while(i--) {
            console.log(" $$ adding label", labels[i]);
            var t = this.add_label(labels[i]);
            if (t){
                new_labels.push(labels[i])
            }
        }

        //add new label to our copy nn
        this.Net.addLabel(new_labels);

        var newParams = this.Net.getParams();
        //tell SGD to accomodate this new labels
        // console.log('sent to server '+newParams.length);
        this.SGD.resize_param(newParams);

        socket.emit('message', {
            type: 'data_upload_done',
            data: ids.length
        });

    },

    register_data: function(slave, ids) {

        console.log('register data');

        slave = this.slave_available(slave);

        if(!slave) {
            console.log("! Cannot register data at (nn): (client) not available", this.id, slave.socket.id);
            return
        }

        var i = ids.length;
        while(i--) {

            var j = this.data.length;

            while(j--) {

                if(this.data[j].id == ids[i]) {

                    this.data[j].cache.push(slave);

                }

            }

        }

    },

    add_label: function(label) {

        var label = label.toLowerCase();

        if(this.labels.indexOf(label) > -1) {
            // already exists.
            return false;
        }

        this.labels.push(label);

        return true;

    },

    slave_available: function(slave) {

        var i = this.slaves_connected.length;
        while(i--) {
            if(this.slaves_connected[i].socket.id == slave.socket.id) {
                return this.slaves_connected[i];
            }
        }

        return false

    },

    add_slave: function(slave) {

        slave.nn = this;

        this.slaves_connected.push(slave);
        return;

    },

    slave_work: function(slave) {

        var found = false;
        var i = this.slaves_connected.length;
        while(i--) {
            if(this.slaves_connected[i].socket.id == slave.socket.id) {
                found = this.slaves_connected[i];
                break;
            }
        }

        if(!found) {
            console.log('! Cannot set slave to work at (NN): slave not found', slave.socket.id, this.id);
            return;
        }


        var i = this.slaves.length;
        while(i--) {
            if(this.slaves[i].socket.id == slave.socket.id) {
                console.log('! Cannot set slave to work at (NN): slave already at work', slave.socket.id, this.id);
                return;
            }
        }

        this.slaves.push(found);

        slave.boss.send('slave_status', {
            slave_id: found.socket.id,
            status: 'assigned to work'
        });

    },

    slave_track: function(slave) {

        var found = false;
        var i = this.slaves_connected.length;
        while(i--) {
            if(this.slaves_connected[i].socket.id == slave.socket.id) {
                found = this.slaves_connected[i];
                break;
            }
        }

        if(!found) {
            console.log('! Cannot set slave to track at (NN): slave not found', slave.socket.id, this.id);
            return;
        }

        var i = this.slaves_tracking.length;
        while(i--) {
            if(this.slaves_tracking[i].socket.id == slave.socket.id) {
                console.log('! Cannot set slave to track (NN): slave already slaves_tracking', slave.socket.id, this.id);
                return;
            }
        }

        this.slaves_tracking.push(slave);

        slave.boss.send('slave_status', {
            slave_id: found.socket.id,
            status: 'tracking'
        });

    },

    remove_client: function(client) {

        var found = false;
        var i = this.slaves_connected.length;
        while(i--) {
            if(this.slaves_connected[i].socket.id == client.socket.id) {
                this.slaves_connected.splice(i, 1);
                found = true;
                break;
            }
        }

        if(!found) {
            console.log('! Cannot remove (client) from (NN): client not found', client.socket.id, this.id);
            return;
        }

        var i = this.slaves.length;
        while(i--) {
            if(this.slaves[i].socket.id == client.socket.id) {
                this.slaves.splice(i, 1);
                break;
            }
        }

        var i = this.slaves_tracking.length;
        while(i--) {
            if(this.slaves_tracking[i].socket.id == client.socket.id) {
                this.slaves_tracking.splice(i, 1);
                break;
            }
        }

        // remove data
        var i = this.data.length;

        var points_lost = 0;

        while(i--) {

            var j = this.data[i].assigned.length;
            while(j--) {
                if(this.data[i].assigned[j].id == client.socket.id) {
                    this.data[i].assigned.splice(j, 1);
                }
            }

            var j = this.data[i].cache.length;
            while(j--) {
                if(this.data[i].cache[j].id == client.socket.id) {
                    this.data[i].cache.splice(j, 1);
                }
            }

        }

        console.log('> Removed (client) from (NN)', client.socket.id, this.id);

        client.nn = null;

    },

    remove_client_graceless: function(client) {

        // disconnect.

        console.log('> Graceless removal of (slave) from (NN)', client.socket.id, this.id);

        this.remove_client(client);

        var removed = false;

        // do things wrt. to the reduction step to make sure network continues.
        var i = this.slaves_operating.length;
        while(i--) {
            if(this.slaves_operating[i].socket.id == client.socket.id) {
                this.slaves_operating.splice(i, 1);
                removed = true;
            }
        }

        if(removed) {
            console.log('> (slave) was in operation for (NN), slave shutdown.', client.socket.id, this.id);

            if(!this.slaves_operating.length) {
                // was the last one.
                // do reduction function.
                console.log('> (slave) was last in operation for (NN), slave shutdown.', client.socket.id, this.id);

                //this.aggregation();

                console.log('> Reduce (NN)', this.id);

                // begin again
                //this.run();
            }

        }

    },

    total_power: function() {
        sum = 0;
        var i = this.slaves.length;
        while(i--) {
            sum += this.slaves[i].power;
        }
        return sum;
    },

    start: function() {

        if(this.running) {
            console.log("! Cannot start (NN): already started", this.id);
            return
        }

        this.running = true;

        this.master.broadcast_nns();

        this.run();

    },

    pause: function() {

        if(!this.running) {
            console.log("! Cannot pause (NN): already paused", this.id);
            return
        }

        this.running = false;

        this.master.broadcast_nns();

    },

    reboot: function() {

        this.running = false;

        this.master.broadcast_nns();

    },

    run: function() {

        if(!this.running) {
            return;
        }

        if(!this.data.length) {
            console.log("! Cannot run (NN): no data", this.id);
            return
        }

        if(!this.slaves_connected.length) {
            console.log("! Cannot run (NN): no slaves assigned to work", this.id);
            return
        }

        this.allocate();
        
        this.initiate();

    },

    allocate: function() {

        sort_data = function(a,b) {
            // low to high
            cache = a.cache.length - b.cache.length; 
            if(cache == 0) {
                return a.assigned.length - b.assigned.length;
            }
            return cache;
        }

        filter_unfilled_slaves = function(a) {
            return !a.saturated()
        }

        filter_cache_slaves = function(a) {
            return a.cache_left() > 0
        }

        in_slave_cache = function(point, slave) {

            var m = point.assigned.length;
            while(m--) {
                if(point.assigned[m].socket.id == slave.socket.id) {
                    return true;
                }
            }
            return false;

        }

        in_cache = function(point, slave) {

            // check on BOSS, not on CLIENT.
            // if a BOSS drops, many CLIENTS drop.
            // else fake data coverage.

            var m = point.cache.length;
            while(m--) {
                if(point.cache[m].boss.socket.id == slave.boss.socket.id) {
                    return true;
                }
            }

            var m = point.assigned.length;
            while(m--) {
                if(point.assigned[m].boss.socket.id == slave.boss.socket.id) {
                    return true;
                }
            }
            return false;

        }

        total_power = this.total_power()

        normalize_factor = total_power / this.data.length;

        console.log("> (NN) allocates (power) with (factor):", this.id, total_power, normalize_factor);

        fraction_difference = 0;

        var i = this.slaves.length;

        // assign all slaves their power

        while(i--) {
            slave = this.slaves[i];

            power_float = slave.power / normalize_factor;
            power_int = Math.floor(power_float);

            fraction_difference += power_float - power_int;

            if (Math.abs(fraction_difference - 1) < 0.000001) {
                power_int += 1;
                fraction_difference = 0;
            }

            if(power_int > slave.max_power) {
                power_int = slave.max_power;
            }

            slave.assigned_power = power_int;

            // dump assigned cache
            slave.assigned_cache = [];

        }

        var j = this.data.length;

        // assign data points to slaves having it already in cache 

        while(j--) {

            point = this.data[j];

            point.process = [];

            var k = point.cache.length;

            while(k--) {

                var cache_slave = point.cache[k];

                if(!cache_slave.saturated()) {
                    cache_slave.assigned_cache.push(point);
                    point.assigned.push(cache_slave);

                    point.process.push(cache_slave);

                    break;
                }

            }

        }

        this.data = this.data.sort(sort_data);

        var unfilled_slaves = this.slaves.filter(filter_unfilled_slaves);

        var j = unfilled_slaves.length;

        var k = this.data.length;

        // assign remaining uncached data points

        while(j-- && k--) {

            var slave = unfilled_slaves[j];

            var point = this.data[k];

            if(!point.process.length) {

                slave.assigned_cache.push(point);
                
                if(!in_slave_cache(point, slave)) {
                    slave.uncached.push(point);
                }
                
                point.assigned.push(slave);

                point.process.push(slave);

            }

            if(!slave.saturated()) {
                j++;
            }

        }
        

        var i = this.slaves.length;
        while(i--) {
            this.slaves[i].process_cache(this);
        }

    },

    initiate: function() {

        sort_data = function(a,b) {
            // low to high
            return a.cache.length - b.cache.length; 
        }

        filter_data = function(a) {
            return a.cache.length
        }

        sort_slaves = function(a, b) {
            // low to high
            return a.assigned_power.length - b.assigned_power.length;
        }

        filter_slaves = function(a) {
            return a.assigned_power >= 10; // at least 10 points, or too slow.
        }

        in_cache = function(point, slave) {

            var m = point.cache.length;
            while(m--) {
                if(point.cache[m].socket.id == slave.socket.id) {
                    return true;
                }
            }
            return false;

        }

        var datamap = this.data.filter(filter_data).sort(sort_data);

        if(!datamap.length) {
            console.log('> 1 (NN) cannot initiate: data not available on slaves (yet)', this.id);
            this.running = false;
            return
        }

        // sort on slave cache size
        var slaves = this.slaves.filter(filter_slaves).sort(sort_slaves);
        //var slaves = this.slaves.sort(sort_slaves);

        if(!slaves.length) {
            // should not be possible because datamap checks this aswell above.
            console.log('> 2 (NN) cannot initiate: data not available on slaves (yet)', this.id);
            this.running = false;
            return
        }

        var i = slaves.length;
        while(i--) {
    
            // first the slaves with least cache pick their choice
            var slave = slaves[i];

            var j = datamap.length;

            while(j--) {

                var point = datamap[j];

                if(in_cache(point,slave)) {

                    // assign
                    slave.process.push(point.id);

                    if(slave.process.length == slave.assigned_power) {

                        this.slaves_operating.push(slave);
                        slave.work(this);
                        break;

                    }

                }

            }

        }

    },

    reduction: function(slave, parameters, new_labels) {

        if(!this.running) {
            console.log("! Cannot reduce (slave) to (NN): NN not running", slave.socket.id, this.id);
            return;
        }

        removed = false;

        var i = this.slaves_operating.length;
        while(i--) {
            if(this.slaves_operating[i].socket.id == slave.socket.id) {
                this.slaves_operating.splice(i, 1);
                removed = true;
            }
        }

        if(!removed) {
            console.log("! Cannot reduce (slave) to (NN): Slave not active in this NN.", slave.socket.id, this.id);
            return;
        }

        d = new Date().getTime();

        this.operation_results.push(parameters);

        this.runtime_elapsed += parseInt(this.iteration_time);
        this.data_seen += parameters.nVector;

        var i = new_labels.length;
        while(i--) {
            this.add_label(new_labels[i]);
        }

        if(!this.slaves_operating.length && this.running == false) {

            // standstill. broadcast.

            this.master.broadcast_log('Network standstill: ' +  this.nn);

            return;

        }

        if(!this.slaves_operating.length) {
            // was the last one.
            // do reduction function.

            this.aggregation();

            this.operation_results = [];

            console.log('> Reduce (NN)', this.id);

            // begin again

            this.realtime_elapsed += parseInt(this.iteration_time);

            this.run();
        }

    },

    aggregation: function() {

        if(!this.operation_results.length) {
            console.log("! Cannot aggregate (NN): No operation results.", this.id);
            return;
        }

        // if(this.step == 0) {
        //     // Create object SGD Trainer            
        //     this.SGD = new SGDTrainer(this, {});
        //     this.SGD.set_parameters(this.hyperparameters);
        // }

        if(this.hyperparameters_changed) {
            console.log('Updated (NN) with new hyperparameters.', this.id);
            this.SGD.set_parameters(this.hyperparameters);
            this.hyperparameters_changed = false;
        }

        this.SGD.reduce(this);

        this.step++;

        var i = this.slaves_tracking.length;
        while(i--) {
            this.slaves_tracking[i].track(this);
        }

        this.master.broadcast_nns();

    }

}

module.exports = NeuralNetwork;