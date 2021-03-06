var Boss = function(angular) {

    this.angular = angular;

    this.id;
    this.socket;

    this.running = false;

    this.slaves = [];

    this.nns = [];

    this.downloader = null; // the web worker for downloading data

    this.log = [];

    this.host;
    this.imagehost;

    this.camera_image;

    this.process_shards = {};
    this.process_data_working = false;
    this.process_key = 0;

}

Boss.prototype = {

    logger: function(t) {

        text = new Date().toLocaleString();
        text += ' > ';
        text += t
        text += '\n';

        this.log.push(text);
        this.log = this.log.slice(-100, 200);

        this.angular.apply();
    },

    obj_to_list: function(files) {

        var list = [];

        var r = Object.keys(files);

        var i = r.length;
        while(i--) {
            list.push(files[r[i]]);
        }

        return list;

    },

    nn_by_id: function(id) {

        var i = this.nns.length;
        while(i--) {
            if(this.nns[i].id == id) {
                return this.nns[i];
            }
        }

        return false;

    },

    nn_name_by_id: function(id) {

        return this.nn_by_id(id).name;

    },

    slave_by_id: function(slave_id) {

        var i = this.slaves.length;
        while(i--) {
            if(this.slaves[i].id == slave_id) {
                return this.slaves[i];
            }
        }

        return false;

    },

    slaves_by_nn_id: function(nn_id) {

        var filtered = this.slaves.filter(function(a) {
            return a.nn == nn_id;
        });

        return filtered;

    },

    number_of_nn_my_slaves_by_id: function(nn_id) {

        return this.slaves.filter(function(a) {
            return a.nn == nn_id;
        }).length;

    },

    change_status: function(slave, text) {

        if(text == 'working') {
            slave.working = true;
        } else if(text == 'waiting for master') {
            slave.working = false;
        } else if(text == 'waiting for task') {
            
            if(slave.task_callback) {
                slave.task_callback(slave);
            }

        }

        slave.state = text;
        this.angular.apply();

    },

    worker_stats: function(slave, data) {
        slave.power = data.worker_power;
    },

    message_from_slave: function(that, e) {

        type = e.data.type;
        data = e.data.data;

        if(type == 'slave_id') {
            // do inline, because socket is available (in 'this')
            that.id = data;
            this.logger('Slave active with id: ' + data);
        } else if(type == 'logger') {
            this.logger(data);
        } else if(type == 'download_done') {
            this.download_done();
        } else if(type == 'status') {
            this.change_status(that, data);            
        } else if(type == 'download_parameters') {
            this.download_parameters(data);            
        } else if(type == 'classify_results') {
            this.classify_results(data);            
        } else if(type == 'stats_results') {
            this.stats_results(that, data);
        } else if(type == 'worker_stats') {
            this.worker_stats(that, data);
        } else if(type == 'workingset') {
            // change status does angular.apply
            that.workingset = data;
        }

    },

    message_to_slave: function(slave, type, data, buffer) {

        var buffer = (typeof buffer === "undefined") ? null : buffer;

        // firefox issue

        if(buffer) {

            slave.postMessage({
                type: type,
                data: data
            }, buffer);

        } else {

            slave.postMessage({
                type: type,
                data: data
            });

        } 

    },

    message_to_master: function(type, data) {

        this.socket.emit("message", {type: type, data: data});

    },

    new_slave_instance: function(slave, cb) {

        slave = new Worker('/static/js/webworker.js');
        return cb(slave);

    },

    start_slave: function(nn_id, task_callback) {

        var that = this;
        var slave;

        // task immediately to assign at ready.
        var task_callback = (typeof task_callback === "undefined") ? false : task_callback;

        if(!this.nn_by_id(nn_id)) {
            this.logger('! Cannot start slave: NN does not exist: ' + nn_id);
            return;   
        }

        this.new_slave_instance(slave, function(slave) {

            slave.onmessage = function(e) { that.message_from_slave(this, e); }

            that.message_to_slave(slave, 'start', {
                boss_id: that.id,
                nn_id: nn_id,
                host: this.host
            });

            slave.nn = nn_id;

            slave.type = null;
            slave.state = 'idle';
            slave.data_cached = 0;
            slave.data_allocated = 0;
            slave.workingset = 0;
            slave.working = false;

            if(task_callback) {
                slave.task_callback = task_callback;
            }

            that.slaves.push(slave);

            that.angular.apply();

        });

        return slave;

    },

    download_done: function() {
        // signal for the downloader to continue downloading.
        this.message_to_downloader('continue');
    },

    set_slave_status: function(data) {

        var id = data.slave_id;
        var status = data.status;

        var slave = this.slave_by_id(id);
        var nn = this.nn_by_id(slave.nn);

        slave.state = status;

        this.logger('Changed slave status at NN "' + nn.name + '" to "' + status + '"');

        //this.angular.apply();

    },

    data_assignment: function(data) {

        var slave = this.slave_by_id(data.slave_id);
        slave.data_allocated = data.data.length;

        slave.state = 'downloading data';

        this.logger('Data assignment for slave "' + data.slave_id + '": ' + data.data.length + ' points.');

        this.message_to_downloader('download', {
            destination: data.slave_id,
            ids: data.data
        });

        this.angular.apply();

    },

    save_hyperparameters: function(nn_id, hyperparameters) {

        var nn = this.nn_by_id(nn_id);

        if(!nn) {
            this.logger('! Cannot update hyperparameters: NN does not exist: ' + nn_id);
            return;   
        }

        this.message_to_master('save_hyperparameters', {
            nn_id: nn_id,
            hyperparameters: hyperparameters
        });

    },

    download_new_parameters: function(nn_id) {
        // download NN parameters by XHR

        var that = this;

        var xhr = new XMLHttpRequest();
        xhr.open('GET', this.host + '/nn-parameters/' + nn_id + '/', true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

        console.log( ' $$ downloading new parameters');

        xhr.onload = function () {

            console.log( ' $$ parameter download done');

            var response = this.response;

            // send to all associated workers for this nns

            var slaves = that.slaves_by_nn_id(nn_id);

            var i = slaves.length;
            while(i--) {

                console.log( ' $$ sending parameters to slave:', slaves[i].id);
                that.message_to_slave(slaves[i], 'parameters', response);

            }

        }
            
        xhr.send();

    },

    start_nn: function(nn_id) {

        var nn = this.nn_by_id(nn_id);

        if(!nn) {
            this.logger('! Cannot start NN: NN does not exist: ' + nn_id);
            return;   
        }

        this.message_to_master('start_nn', {
            nn_id: nn_id
        });

    },

    pause_nn: function(nn_id) {

        var nn = this.nn_by_id(nn_id);

        if(!nn) {
            this.logger('! Cannot pause NN: NN does not exist: ' + nn_id);
            return;   
        }

        this.message_to_master('pause_nn', {
            nn_id: nn_id
        });

    },

    reboot_nn: function(nn_id) {

        var nn = this.nn_by_id(nn_id);

        if(!nn) {
            this.logger('! Cannot reboot NN: NN does not exist: ' + nn_id);
            return;   
        }

        this.message_to_master('reboot_nn', {
            nn_id: nn_id
        });

    },

    add_data: function(nn_id, data) {

        var nn = this.nn_by_id(nn_id);

        if(!nn) {
            this.logger('! Cannot upload data to NN: NN does not exist: ' + nn_id);
            return;   
        }

        var data = JSON.parse(data);

        this.message_to_master('add_data', {
            nn_id: nn_id,
            ids: data.ids,
            labels: data.labels
        });

    },

    data_upload_done: function(data) {

        this.logger('Done uploading data: ' + data + ' points.');

    },

    init: function(id) {

        this.id = id;

        this.logger('Boss connected');

        this.socket.emit('message', {
            type: 'register_boss',
            data: ''
        });

    },

    list_nns: function(nns) {

        this.nns = nns;
        this.angular.apply();

    },

    message_from_master: function(d) {

        var type = d.type;
        var data = d.data;

        if(type == 'init') {
            this.init(data);
        } else if(type == 'logger') {
            this.logger(data);
        } else if(type == 'list_nns') {
            this.list_nns(data);    
        } else if(type == 'slave_status') {
            this.set_slave_status(data);
        } else if(type == 'data_assignment') {
            this.data_assignment(data);
        } else if(type == 'data_upload_done') {
            this.data_upload_done(data);
        } else if(type == 'download_new_parameters') {
            this.download_new_parameters(data);
        } else if(type == 'ping') {
            this.message_to_master('pong');
        }

    },

    add_nn: function(nn, full_net) {

        var that = this;

        var full_net = (typeof full_net === "undefined") ? false : full_net;

        var new_nn;

        if(full_net) {
            new_nn = full_net;
        } else {
            new_nn = new mlitb.Net();
            new_nn.createLayers(nn.configuration);
        }

        var pkg = nn;
        pkg.nn = new_nn.getConfigsAndParams();
        pkg.boss = this.id;

        var xhr = new XMLHttpRequest();
        xhr.open('POST', this.host + '/add-nn/', true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.onload = function () {

            that.logger('New neural added done.');

        }
            
        xhr.send(JSON.stringify(pkg));

    },

    remove_nn: function(nn_id) {

        if(!this.nn_by_id(nn_id)) {
            this.logger('! Cannot remove NN: NN does not exist: ' + nn_id);
            return;   
        }

        this.message_to_master('remove_nn', {
            nn_id: nn_id
        });

    },

    slave_work: function(nn_id, slave_id) {
        
        var slave;

        if(!this.nn_by_id(nn_id)) {
            this.logger('! Cannot set slave to work: NN does not exist: ' + nn_id);
            return;   
        }

        slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot set slave to work: Slave does not exist: ' + slave_id);
            return;   
        }

        slave.type = 'train';

        this.message_to_master('slave_work', {
            nn_id: nn_id,
            slave_id: slave_id
        });

    },

    slave_track: function(nn_id, slave_id) {

        var slave;

        if(!this.nn_by_id(nn_id)) {
            this.logger('! Cannot set slave to track: NN does not exist: ' + nn_id);
            return;   
        }

        slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot set slave to track: Slave does not exist: ' + slave_id);
            return;   
        }

        slave.type = 'track';

        this.message_to_slave(slave, 'start_track');

        this.message_to_master('slave_track', {
            nn_id: nn_id,
            slave_id: slave_id
        });

    },

    slave_download: function(slave_id) {

        var slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot download parameters from slave: Slave does not exist: ' + slave_id);
            return;   
        }

        this.message_to_slave(slave, 'download');

    },

    download_parameters: function(c) {

        var data = c.data;

        var blob = new Blob([JSON.stringify(data)], {type: "application/json;charset=utf-8"});
        saveAs(blob, "parameters.json");

    },

    add_label: function(slave_id, label) {

        var slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot add image label: Slave does not exist: ' + slave_id);
            return;   
        }

    },

    handle_camera: function(evt, slave_id) {

        getEXIF = function(f, cb) {

            var reader = new FileReader();

            reader.onload = function(file) {

                var exif, transform = "none";
                exif = EXIF.readFromBinaryFile(createBinaryFile(file.target.result));

                cb(exif, f);

            }

            reader.readAsArrayBuffer(f);

        }

        var that = this;
        var slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot process camera image: Slave does not exist: ' + slave_id);
            return;   
        }

        var nn = this.nn_by_id(slave.nn);

        var files = evt.target.files; // FileList object

        // Loop through the FileList and render image files as thumbnails.
        for (var i = 0, f; f = files[i]; i++) {

            // Only process image files.
            if (!f.type.match('image.*')) {
                continue;
            }

            exif = getEXIF(f, function(exif, f) {

                var reader = new FileReader();

                // Closure to capture the file information.
                reader.onload = function(theFile) {

                    var image = new Image();
                    image.src = reader.result;

                    image.onload = function() {

                        var width = nn.configuration[0].sx;
                        var height = nn.configuration[0].sy;

                        var canvas = document.getElementById("image"); 
                        canvas.width = width;
                        canvas.height = height;

                        var mpImg = new MegaPixImage(image);
                        mpImg.render(canvas, { width: width, height: height, orientation: exif.Orientation });

                        var imageData = canvas.getContext("2d").getImageData(0, 0, width, height);

                        // image pixel data
                        // array, set up as [r,g,b,a,r,g,b,a, ...]
                        // thus each four numbers are 1 pixel
                        var converted_image = that.convert_image(imageData.data);

                        that.message_to_slave(slave, 'classify', converted_image, [converted_image.buffer]);

                    };

                };

                reader.readAsDataURL(f);

            });
        
        }

    },

    classify_results: function(results) {

        this.angular.camera_done(results);

    },

    add_stats_file: function(slave_id, file, cb) {

        var that = this;

        var flatten_zip_file = function(files) {

            var new_files = {};

            var illegal_chars = ['.', '_'];
            var valid_extensions = ['jpg', 'jpeg', 'png', 'gif'];

            files = that.obj_to_list(files);

            var i = files.length;
            while(i--) {
                var file = files[i];

                extension = file.name.split('.');

                names = file.name.split('/');

                if(names.length < 2) {
                    console.log('Faulty directory structure:', names);
                    continue;
                }

                name = names[names.length-2].toLowerCase();

                // check for directory names / file names with illegal starting chars

                var j = names.length;

                var faulty = false;

                while(j--) {

                    var n = names[j];
                    
                    if( illegal_chars.indexOf(n[0]) > -1) {
                        console.log('Illegal file/directory name:', names);
                        faulty = true;
                        break;
                    }
                }

                if(faulty) {
                    continue;
                }

                if(extension.length == 1 || (extension[0] == '' && extension.length == 2)) {
                   console.log('Unsupported file extension:', names);
                   continue;
                }

                extension = extension.pop().toLowerCase();

                if(valid_extensions.indexOf(extension) == -1) {
                    console.log('Unsupported file extension:', names);
                    continue;
                }

                file.comment = name;
                file.name = i + '.jpg';

                new_files[i] = file;

            }

            return new_files;

        }

        var that = this;

        slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot remove slave: Slave does not exist: ' + slave_id);
            return;   
        }

        var reader = new FileReader();

        reader.onload = function(theFile) {

            var zip = new JSZip();
            zip.load(reader.result);

            var job = {
                files: flatten_zip_file(zip.files),
                tracking: true,
                callback: cb
            }

            if(that.process_shards[slave_id] === undefined) {
                that.process_shards[slave_id] = [];
            }

            that.process_shards[slave_id].push(job);

            if(!that.process_data_working) {
                that.process_data();
            }

        };

        reader.readAsArrayBuffer(file);

    },

    init_chart: function(slave, selector, name, color) {

        var data = [];
        /*
        if(slave.chart_data && slave.chart_data.length) {
            data = slave.chart_data;
        }
        */
       
        $(selector).highcharts({
            title: {
                text: null
            },
            exporting: {
                enabled: true
            },
            yAxis: {
                title: {
                    text: null
                },
                plotLines: [{
                    value: 0,
                    width: 1,
                    color: color
                }]
            },
            xAxis: {
              minTickInterval: 1
            },
            series: [{
              data: data,
              name: name,
              color: color,
              point: {
                  events: {
                      'click': function() {
                          if (this.series.data.length > 1) this.remove();
                      }
                  }
              }
            }]
        });

        return $(selector).highcharts();

    },

    stats_results: function(slave, data) {

        var drawChart = function(chart, point) {

            series = chart.series[0];

            shift = false;
            if(series.data.length >= 2000) {
                shift = true;
            }

            chart.series[0].addPoint(point, true, shift);

            /*
            if(!slave.chart_data) {
                slave.chart_data = [];
            }

            slave.chart_data.push(point);
            */

            return chart;

        }

        if(!slave.chart) {
            slave.chart = this.init_chart(slave, '#chartcontainer', 'error', '#0000FF');
        }

        slave.chart = drawChart(slave.chart, [data.step, parseFloat(data.error)]);

    },

    remove_slave: function(slave_id) {

        var slave;

        slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot remove slave: Slave does not exist: ' + slave_id);
            return;   
        }

        this.message_to_slave(slave, 'remove');

        var i = this.slaves.length;
        while(i--) {
            if(this.slaves[i].id == slave_id) {
                this.slaves.splice(i, 1);
                break
            }
        }

        this.angular.apply();

    },

    convert_image: function(image) {

        // rgbargbargba -> rrrgggbbb (drop a)
        var new_image = [];

        var r = [];
        var g = [];
        var b = [];

        // forward loop for readability
        // could do backwards aswell for speed.
        for(var i = 0; i < image.length; i++) {

            idx = i + 1;
            
            // normalize to -0.5 to 0.5
            // normalize 0-1
            // pixel = image[i] / 255.0; // - 0.5;
            pixel = image[i];
            if(idx % 4 == 0) {
                // skip alpha channel
                continue;
            }

            if(idx % 4 == 1) {
                // red channel
                r.push(pixel);
            } else if(idx % 4 == 2) {
                // green channel
                g.push(pixel);
            } else if(idx % 4 == 3) {
                // blue channel
                b.push(pixel);
            }

        }

        return new Uint8ClampedArray(new_image.concat(r).concat(g).concat(b));

    },

    process_data: function() {

        this.process_data_working = true;

        // interleave data. Select next key from object, else start over.
        var process_data_keys = Object.keys(this.process_shards);

        if(process_data_keys.length == 0) {
            this.process_data_working = false;
            return;            
        }

        var key = process_data_keys[this.process_key];

        if(key === undefined) {
            this.process_key = 0;
            return this.process_data();
        }

        var slave_jobs = this.process_shards[key];

        if(slave_jobs.length == 0) {
            delete this.process_shards[key];
            return this.process_data();
        }

        var job = slave_jobs.pop();

        var extension_map = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif'
        }

        var that = this;

        var ids = [];

        var slave = this.slave_by_id(key);

        var nn = this.nn_by_id(slave.nn);

        process = function(a) {

            var file = a.pop();

            if(!file) {
                
                //that.logger('Uploading data to worker done.');
                
                if(!job.tracking) {

                    // report to master
                    that.message_to_master('register_data', {
                        ids: ids,
                        slave_id: slave.id,
                        nn_id: slave.nn
                    });

                    slave.state = 'download done';
                    that.angular.apply();

                    //that.download_done();
                
                }

                if(job.callback) {
                    job.callback();
                }

                that.process_key += 1;
                return that.process_data();

            }

            slave.state = 'decoding data';

            var split = file.name.split('.');

            var id = parseInt(split[0]);

            var extension = split[split.length-1];

            if(extension_map[extension] == 'undefined') {
                this.logger('Could not interpret file, unsupported file format: ' + extension);
                return process(a);
            }


            var b = file.asUint8Array();

            var blob = new Blob([b], {type: 'text/plain'});
            var url = URL.createObjectURL(blob);

            var img = new Image();

            img.src = url;

            img.onerror = function(e) {

                that.logger('Error decoding image ID: ' + id);
                return process(a);

            }

            img.onload = function() {

                ids.push(id);

                var width = nn.configuration[0].sx;
                var height = nn.configuration[0].sy;

                var canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                var mpImg = new MegaPixImage(img);
                mpImg.render(canvas, {width: width, height: height});

                var context = canvas.getContext('2d');

                var data = context.getImageData(0, 0, width, height).data;

                var tranferobject = {
                    id: id,
                    data: that.convert_image(data),
                    label: file.comment.toLowerCase()
                }

                that.message_to_slave(slave, 'download_data', tranferobject, [tranferobject.data.buffer]);

                slave.data_cached += 1;

                img = null;
                blob = null;
                url = null;
                mpImg = null;
                context = null;
                canvas = null;

                return process(a);

            }

        }

        slave.state = 'decoding data';

        return process(this.obj_to_list(job.files));

    },

    data_for_slave: function(data) {

        shard_files = function(files) {

            var shard_size = 100;
            var files_size = files.length;
            var shards = files_size / shard_size;
            shards = Math.ceil(shards);

            var slice;
            var sharded_files = [];
            for(var i = 0; i < shards; i++) {

                slice_start = i * shard_size;
                slice_end = (i + 1) * shard_size;

                slice = files.slice(slice_start, slice_end);
                sharded_files.push(slice);

            }

            return sharded_files;

        }

        var slave_id = data.slave_id;
        var data = data.data;

        var slave = this.slave_by_id(slave_id);

        if(!slave) {
            this.logger('! Cannot transfer data to slave: Slave does not exist: ' + slave_id);
            
            // signal downloader to continue.
            this.download_done();
            return;

        }

        slave.state = 'waiting to decode';
        this.angular.apply();

        var new_zip = new JSZip();
        new_zip.load(data);

        var shards = shard_files(this.obj_to_list(new_zip.files));

        if(this.process_shards[slave_id] === undefined) {
            this.process_shards[slave_id] = [];
        }

        var i = shards.length;
        while(i--) {

            var job = {
                files: shards[i],
                tracking: false,
                callback: false
            }

            this.process_shards[slave_id].push(job);

        }

        if(!this.process_data_working) {
            this.process_data();
        }

    },

    new_downloader_instance: function(downloader, cb) {

        downloader = new Worker('/static/js/downloader.js');
        return cb(downloader);

    },

    message_to_downloader: function(type, data) {

        this.downloader.postMessage({
            type: type,
            data: data
        });

    },

    message_from_downloader: function(that, e) {

        type = e.data.type;
        data = e.data.data;

        if(type == 'logger') {
            this.logger(data);
        } else if(type == 'data_for_slave') {
            this.data_for_slave(data);
        }

    },

    start_public: function(nn_id) {

        // start up 2 workers
        // id 0: camera - set to track immediately
        // id 1: worker - 

        var that = this;

        var set_camera_task = function(slave) {

            console.log('set camera task');

            that.slave_track(slave.nn, slave.id);

            that.angular.public_ready = true;
            that.angular.camera_slave = slave;
            that.angular.apply();

        }

        var set_worker_start = function(slave) {

            that.angular.worker_slave = slave;
            that.angular.public_ready = true;
            that.angular.apply();

        }

        var camera_slave = this.start_slave(nn_id, set_camera_task); // camera one
        var worker_slave = this.start_slave(nn_id, set_worker_start); // worker one

        return [camera_slave, worker_slave];

    },

    start_downloader: function() {

        var downloader;
        var that = this;

        this.new_downloader_instance(downloader, function(downloader) {

            downloader.onmessage = function(e) { that.message_from_downloader(this, e); }

            that.downloader = downloader;

            that.message_to_downloader('start', {
                boss_id: that.id,
                imagehost: this.imagehost
            });

            
        });

    },

    start: function(host, imagehost) {

        var that = this;

        if(this.running) {
            this.logger('Boss is already connected');
            return;
        }

        this.host = host;
        this.imagehost = imagehost;

        this.socket = io.connect(host);

        this.socket.on('message', function (d) { that.message_from_master(d); });

        this.start_downloader();

    }

};

if(typeof(module) !== 'undefined') {
    module.exports = Boss;
}