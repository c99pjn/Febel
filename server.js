var fs = require('fs');
var path = require('path');
var httpServer = require('http').createServer(
    function(request, response) {
        if(request.url != '' && request.url != '/favicon.ico'){//request.url is the file being requested by the client
            console.log(request.url);
            //if (filePath == './'){filePath = './features_ws.html';} // Serve index.html if ./ was requested
            //var filename = path.basename('./features_ws.html');
            //var extname = path.extname('./features_ws.html');
            var contentType = 'text/html';
            var filePath = '.' + request.url;
            if (filePath.indexOf('.js') > -1) {
                contentType = 'text/javascript';
            } else if (filePath.indexOf('.css') > -1) {
                contentType = "text/css";
            } else if (filePath.indexOf('.png') > -1) {
                contentType = "image/png";
            } else {
                filePath = './index.html';
            }

            fs.readFile(filePath, function(error, content) {
                response.writeHead(200, { 'Content-Type': contentType });
                response.end(content, 'utf-8');
            });
        }
    }
).listen(8888);

var WebSocketServer = require('ws').Server;
var mysql = require('mysql');
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'feature',
  password : 'feature',
  port     : 3306,
  database : 'features'
});

var wss = new WebSocketServer({port: 8080});
var wscon = {};

var unique_id = 0;
var nr_connections = 0;
wss.on('connection', function(ws) {
    var id = unique_id++;
    nr_connections++;
    wscon[id] = ws;
    console.log("Connection: "+id+" established");
    ws.on('message', function(message) {
        console.log('received: %s', message);
        var obj = JSON.parse(message)[0];
        if (obj["initial"]) {
            sendInitial(obj["project"]);
        }
        if (obj["get_groups"]) {
            sendGroups(obj["project"]);
        }
        if (obj["feature_id"] == "new") {
            insertDB("insert into feature (feature_name, info, project) values ('"+(obj["feature_name"]||"")+"', '"+(obj["info"]||"")+"','"+obj["project"]+"')");
        } else if (obj["feature_id"] == "taggroup") {
            updateGroup(obj["project"], obj["old"], obj["new"]);
        } else {
            var query = "";            
            if (obj["feature_name"]) {
                if (obj["feature_name"].replace(/<br>/g,"") == "") {
                    updateDB("delete from feature where feature_id = "+obj["feature_id"], obj["feature_id"]);   
                } else {
                    updateDB("update feature set feature_name='"+obj["feature_name"]+"' where feature_id="+obj["feature_id"], obj["feature_id"]);
                }
            } else if (obj["feature_name"] == "") {
                updateDB("delete from feature where feature_id = "+obj["feature_id"], obj["feature_id"]);
            }
            if (obj["info"]) {
                updateDB("update feature set info='"+obj["info"]+"' where feature_id="+obj["feature_id"], obj["feature_id"]);
            }
            if (obj["tags"]) {
                if (obj["tags"][0].id == "") {
                    insertTag(obj["feature_id"], obj["tags"][0].name, obj["tags"][0].group);
                } else {
                    if (obj["tags"][0].name.replace(/<br>/g,"") == "") {
                        deleteTag(obj["feature_id"], obj["tags"][0].id);
                    } else {
                        updateDB("update tag set tag_name='"+obj["tags"][0].name+"' where tag_id="+obj["tags"][0].id, obj["feature_id"]);
                    }
                }    
            }
        }
    });
    
    ws.on('close', function() {
        console.log("Connection: "+id+" closed");
        nr_connections--;
        delete wscon[id];
    });

    function updateDB(q, f_id) {
        console.log(q);
        connection.query(q, function(err, rows, field) {
             sendUpdate(f_id);
	   });
    }

    function updateGroup(project, oldT, newT) {
        connection.query("update tag join feature_tag_rel on feature_tag_rel.tag_id = tag.tag_id join feature on feature.feature_id = feature_tag_rel.feature_id set tag.tag_group='"+newT+"' where tag.tag_group='"+oldT+"' and feature.project='"+project+"'" , function(err, rows, field) {
            console.log("hej")
        });
    }

    function insertDB(q, f_id) {
        connection.query(q, function(err, rows, field) {
             sendUpdate(rows["insertId"]);
        });
    }

    function insertTag(f_id, name, group) {
        connection.query("select * from tag where tag_name='"+name+"' and tag_group='"+group+"'", function(err, rows, fields) {
            if (rows.length == 0) {
                connection.query("insert into tag (tag_name, tag_group) values ('"+name+"','"+group+"')", function(err, rows, fields) {
                    var tag_id = rows["insertId"];
                    connection.query("insert into feature_tag_rel (feature_id, tag_id) values ("+f_id+","+tag_id+")", function(err, rows, fields) {
                        sendUpdate(f_id);
                    });
                });    
            } else {
                var tag_id = rows[0].tag_id;
                connection.query("insert into feature_tag_rel (feature_id, tag_id) values ("+f_id+","+tag_id+")", function(err, rows, fields) {
                    sendUpdate(f_id);
                });
            }
        });
    }

    function deleteTag(f_id, tag_id) {
        connection.query("delete from feature_tag_rel where feature_id="+f_id+" and tag_id="+tag_id, function(err, rows, fields) {
            sendUpdate(f_id);
        });
    }
 
    function sendAll(message) {
        for (var key in wscon) {
            console.log("Connection: "+key+" sending message: "+message);
            wscon[key].send(message);
        };
    }

    function sendUpdate(f_id) {
        connection.query("select feature.feature_id, feature_name, info, ifnull(group_concat(concat(tag.tag_name,'_',cast(tag.tag_id as char),'_',tag.tag_group)),'') as tags from feature left join feature_tag_rel on feature_tag_rel.feature_id = feature.feature_id left join tag on tag.tag_id = feature_tag_rel.tag_id where feature.feature_id="+f_id,
            function(err, rows, fields) {
                var data = rows;
                data.forEach(function(r){
                    var tags = r.tags.split(/,/);
                    r.tags = {};
                    /*for(var i=0; i<tags.length; i++) {
                        if (tags[i] != '') {
                            var tag = tags[i].split(/_/);
                            r.tags[tag[2]] = r.tags[tag[2]] || [];
                            r.tags[tag[2]].push({'id': tag[1], 'name': tag[0]});
                        }
                    }*/
                    r.tags = [];
                    for(var i=0; i<tags.length; i++) {
                        if (tags[i] != '') {
                            var tag = tags[i].split(/_/);
                            r.tags.push({'id': tag[1], 'name': tag[0], 'group': tag[2]});
                        }
                    }
                });
                data[0]["feature_id"] = f_id;
                sendAll(JSON.stringify(data));
            });
    }


    function sendInitial(project) {
        sendAll(JSON.stringify({'nr':nr_connections}));
        connection.query("select feature.feature_id, feature_name, info, ifnull(group_concat(concat(tag.tag_name,'_',cast(tag.tag_id as char),'_',tag.tag_group)),'') as tags from feature left join feature_tag_rel on feature_tag_rel.feature_id = feature.feature_id left join tag on tag.tag_id = feature_tag_rel.tag_id where project = '"+ project +"' group by feature.feature_id", 
            function(err, rows, fields) {
                var data = rows;
                data.forEach(function(r) {
                    var tags = r.tags.split(/,/);
                    r.tags = {};
                    /*for(var i=0; i<tags.length; i++) {
                        if (tags[i] != '') {
                            var tag = tags[i].split(/_/);
                            r.tags[tag[2]] = r.tags[tag[2]] || [];
                            r.tags[tag[2]].push({'id': tag[1], 'name': tag[0]});
                        }
                    }*/
                    r.tags = [];
                    for(var i=0; i<tags.length; i++) {
                        if (tags[i] != '') {
                            var tag = tags[i].split(/_/);
                            r.tags.push({'id': tag[1], 'name': tag[0], 'group': tag[2]});
                        }
                    }
                });
                ws.send(JSON.stringify(data));
            });
    }

    function sendGroups(project) {
        connection.query("select distinct tag.tag_group from feature left join feature_tag_rel on feature_tag_rel.feature_id = feature.feature_id left join tag on tag.tag_id = feature_tag_rel.tag_id where project = '"+ project +"'",
            function(err, rows, fields) {
                var data = rows;
                var toSend = {"groups": []};
                data.forEach(function(r) {
                    toSend.groups.push(r.tag_group);
                });
                ws.send(JSON.stringify(toSend));
            });    
    }

    function queryDB(q, callback) {
	console.log(q);
        connection.query(q, function(err, rows, fields) {
            if (err) {console.log(err);}
            else {
                callback(rows, fields);
            }
        });
    }
});


