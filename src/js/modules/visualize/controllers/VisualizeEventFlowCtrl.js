define(['./_module', 'moment', 'd3'],
function (app, moment, d3) {
    'use strict';

    return app.controller('VisualizeEventFlowCtrl', ['$scope','StreamsService','ProjectionsService','UrlBuilder','$stateParams','MessageService',
		function VisualizeEventFlowCtrl($scope,streamsService,projectionsService,urlBuilder,$stateParams,msg) {
            $scope.epoch = 0;
            $scope.correlationIdProperty = "Loading...";
            $scope.causedByProperty = "$causedBy";
            $scope.tree = new CollapsibleTree(d3, moment, "canvas", $scope, msg);
            $scope.projectionStatus = "";

            $scope.updateCorrelationIdProperty = function(){
                var url = urlBuilder.build('/projection/$by_correlation_id')
                projectionsService.query(url,true)
                .success(function(data){
                    $scope.correlationIdProperty = data.correlationIdProperty;
                })
                .error(function(err){
                    msg.failure('Error getting $by_correlation_id projection source')
                    console.error(err);
                });
            };

            $scope.updateProjectionStatus = function(){
                var url = urlBuilder.build('/projection/$by_correlation_id')
                projectionsService.status(url)
                .success(function(data){
                    $scope.projectionStatus = data.status;
                })
                .error(function(err){
                    msg.failure('Error getting $by_correlation_id projection status')
                    console.error(err);
                });
            };

            $scope.startProjection = function(){
                var url = urlBuilder.build('/projection/$by_correlation_id')
                projectionsService.enable(url)
                .success(function(data){
                    msg.success('$by_correlation_id projection started')
                    $scope.updateProjectionStatus();
                })
                .error(function(err){
                    msg.failure('Error starting $by_correlation_id projection')
                    console.error(err);
                });
            }

            $scope.go = function(){
                $scope.selectedEvent = null;
                $scope.tree.clearEvents();
                $scope.epoch++;
                var firstBatch = true;
                var nextEventPosition = 0;
                function loadEvents(startEventPosition, epoch){
                    if(epoch != $scope.epoch) return;
                    var streamDetails = {
                        streamId: "$bc-"+$scope.correlationId,
                        position: ""+startEventPosition,
                        type: "forward",
                        count: "1000"
                    }

                    streamsService.streamEvents(streamDetails)
                    .success(function (data) {
                        if(epoch != $scope.epoch) return;
                        if(data.entries.length > 0){
                            $scope.tree.addEvents(data.entries.reverse(), firstBatch);
                            firstBatch = false;
                            nextEventPosition = data.entries[data.entries.length-1].positionEventNumber+1;
                        }
                        setTimeout(function(){
                            loadEvents(nextEventPosition, epoch)
                        }
                        ,3000);
                    })
                    .error(function (err) {
                        if(epoch != $scope.epoch) return;
                        msg.failure('Correlation Id stream ('+streamDetails.streamId+') does not exist, please make sure that the $by_correlation_id projection is running');
                    });
                }
                loadEvents(nextEventPosition, $scope.epoch);

            }

            $scope.$on('$destroy', function () {
                if($scope.epoch)
                    $scope.epoch++;
            });

            $scope.updateCorrelationIdProperty();
            $scope.updateProjectionStatus();
            if($stateParams.correlationId){
                $scope.correlationId = $stateParams.correlationId;
                $scope.go();
            }
		}]);
});

function CollapsibleTree(d3, moment,div_id, scope, msg){
    //Based on d3 collapsible tree: https://bl.ocks.org/mbostock/4339083
    var svg, root, tree;
    var collapsibleTree = this;

    var id = 0;
    var duration = 500;
    var canvas_id = div_id;
    var margin = {top: 20, right: 120, bottom: 120, left: 120};
    var canvasWidth = document.getElementById(canvas_id).clientWidth;
    var canvasHeight = document.getElementById(canvas_id).clientHeight;
    var width = canvasWidth - margin.right - margin.left;
    var height = canvasHeight - margin.top - margin.bottom;

    var allEvents = {};
    var rootPosition = Number.MAX_SAFE_INTEGER;

    this.path = [];

    //Public functions
    this.draw = function(){
        d3.select("#"+canvas_id+" > *").remove();
        tree = d3.layout.tree()
            .size([height, width]);

        svg = d3.select("#"+canvas_id).append("svg")
            .attr("width", width + margin.right + margin.left)
            .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        root.x0 = height / 2;
        root.y0 = 0;
        root.prevTimeScale = function(d){return 0;};

        d3.select(self.frameElement).style("height", "600px");
        this.makeRootNode(root);
    }

    this.collapseAll = function(){
        traverseAllNodes(root,false).forEach(function(node){
            node.children = null;
        });
        update(root);
    }

    this.expandAll = function(){
        traverseAllNodes(root,false).forEach(function(node){
            node.children = node._children;
        });
        update(root);
    }

    this.smartCollapse = function(){
        smartCollapse();
    }

    this.makeRootNode = function(d){
        root = d;
        newpath = [];
        newpath.push(d);
        while(d._parent){
            d = d._parent;
            newpath.push(d);
        }
        this.path = newpath.reverse();
        collapsibleTree.smartCollapse();
    }

    this.addEvents = function(events, firstBatch){
        if(firstBatch){
            for(var i in events){
                var event = events[i];
                rootPosition = Math.min(rootPosition, event.positionEventNumber);

            }
        }

        for(var i in events){

            var event = events[i];
            var linkMetaData = JSON.parse(event.linkMetaData);
            var isLink = ("$link" in linkMetaData);
            var eventId = !isLink?event.eventId:linkMetaData["$link"].eventId;

            allEvents[eventId] = {};
            allEvents[eventId].eventId = eventId;
            allEvents[eventId].event = event;
            allEvents[eventId].name = event.eventType;
            allEvents[eventId]._children = [];
            allEvents[eventId]._parent = null;
            allEvents[eventId].timestamp = linkMetaData["$eventTimestamp"];

            if(event.positionEventNumber == rootPosition){
                root = allEvents[eventId];
                collapsibleTree.draw();
            }
            else{
                try{
                    var metadata = JSON.parse(event.metaData);
                    var causedByProperty = scope.causedByProperty;

                    var causedByTag = null;
                    if(isLink)
                        causedByTag = linkMetaData["$link"]["metadata"][causedByProperty];
                    else
                        causedByTag = metadata[causedByProperty];

                    if(causedByTag){
                        if(causedByTag in allEvents){
                            allEvents[eventId]._parent = allEvents[causedByTag];
                            allEvents[causedByTag]._children.push(allEvents[eventId]);
                        }
                        else{
                            console.error("parent node not found: "+JSON.stringify(event));
                            msg.failure("Parent node not found for event: "+eventId+" ("+causedByProperty+": "+causedByTag+")");
                        }
                    }
                    else{
                        console.error("no "+causedByProperty+" property on event: "+JSON.stringify(event));
                        msg.failure("No "+causedByProperty+" property on event: "+eventId);
                    }
                }
                catch(err){
                    console.error(err);
                    msg.failure("An error has occured. Please check the console log for more details");
                }
            }
        }

        if(root){
            update(root);
        }
        else{
            console.error("Root node does not exist.");
            msg.failure("Root node does not exist.");
        }

        collapsibleTree.smartCollapse();
    }

    this.clearEvents = function(){
        allEvents = {};
        rootPosition = Number.MAX_SAFE_INTEGER;
    }

    //Private functions
    function getMicroseconds(d){
        var offset = 0;
        if(d.length>20){ //e.g timestamp: 2018-06-13T12:02:58.473717Z
            var rem = d.substring(20,d.length-1);
            while(rem.length < 6) rem += '0';
            offset = (rem[5]-'0') + (rem[4]-'0')*10 + (rem[3]-'0')*100;
        }
        return moment(d).valueOf() * 1000 + offset;
    }

    function traverseAllNodes(d,onlyVisible){
        var nodes = [];
        nodes.push(d);
        if (d._children && (!onlyVisible || d.children)) {
            d._children.forEach(function(child){
                traverseAllNodes(child,onlyVisible).forEach(function(node){
                    nodes.push(node);
                });
            });
        }
        return nodes;
    }

    var findClosestPair = function(c){
        /*
        https://gist.github.com/shaan1337/938b0281271fe3503255409443b53eaf
        O(N log N) divide and conquer algorithm to find closest pair of points based on
        https://en.wikipedia.org/wiki/Closest_pair_of_points_problem#Planar_case

        Input: array of coordinates sorted by x-coordinate e.g [{x:1,y:2},{x:2,y:4},{x:10,y:2}]
        Output: returns minimum distance-squared or Number.MAX_SAFE_INTEGER if there are no pair of points
        */
        if(c.length<=1) return Number.MAX_SAFE_INTEGER;
        else if(c.length==2){
            var dx = c[0].x - c[1].x;
            var dy = c[0].y - c[1].y;
            return dx*dx + dy*dy;
        }
        var c1 = [];
        var c2 = [];
        var mid = Math.floor(c.length/2);
        for(var i=0;i<c.length;i++){
            if(i<mid) c1.push(c[i]);
            else c2.push(c[i]);
        }

        var d = Number.MAX_SAFE_INTEGER;
        d = Math.min(d, findClosestPair(c1));
        d = Math.min(d, findClosestPair(c2));

        var s = [];
        for (var i=0;i<c.length;i++){
            var d1 = c[i].x-c[mid].x;
            if(d1*d1 < d)
                s.push(c[i]);
        }

        s = s.sort(function(a,b){
            return a.y-b.y;
        });

        for (var i=0;i<s.length;i++)
        for (var j=i+1;j<s.length && (s[j].y-s[i].y)*(s[j].y-s[i].y)<d;j++){
            var dx = s[i].x - s[j].x;
            var dy = s[i].y - s[j].y;
            d = Math.min(dx*dx + dy*dy, d);
        }

        return d;
    }

    var smartCollapse = function(){
        /*The smart collapse function collapses nodes until the closest pair of nodes is greater than a certain minimum threshold*/

        /*Expand all nodes before starting*/
        traverseAllNodes(root,false).forEach(function(d){
            d.children = d._children;
        });

        update(root);

        smartCollapseInternal = function(){
            var coords = [];
            var maxTime = -1;
            var minTime = Number.MAX_SAFE_INTEGER;
            /*Traverse all visible nodes*/
            traverseAllNodes(root,true).forEach(function(d){
                /*Keep track of node coordinates*/
                coords.push({x: d.x, y: d.y});

                /*Keep track of smallest/largest timestamp*/
                var time = getMicroseconds(d.timestamp);
                d.timeMicroseconds = time;
                if(time > maxTime)
                    maxTime = time;
                if(time < minTime)
                    minTime = time;
            });

            /*Find closest pair of nodes*/
            var threshold = 150;
            coords = coords.sort(function(a,b){
                if(a.x != b.x) return a.x-b.x;
                else return a.y-b.y;
            });
            var closestDistance = findClosestPair(coords);
            if(closestDistance == Number.MAX_SAFE_INTEGER){
                scope.collapsingNodes = false;
                return;
            }
            else closestDistance = Math.sqrt(closestDistance);

            if(minTime == Number.MAX_SAFE_INTEGER || maxTime == -1){
                scope.collapsingNodes = false;
                return;
            }

            //collapse nodes that are within top 20% of the timescale
            var timeThreshold = minTime + 0.8 * (maxTime - minTime);

            if(closestDistance < threshold){
                traverseAllNodes(root,true).forEach(function(d){
                    if(d.timeMicroseconds >= timeThreshold){
                        if(d._parent){
                            d._parent.children = null;
                        }
                    }
                });

                update(root);
                setTimeout(smartCollapseInternal, duration);
            }
            else{
                scope.collapsingNodes = false;
            }
        }

        scope.collapsingNodes = true;
        smartCollapseInternal();
    }

    function formatTime(time){
        var ms = 1;
        var sec = 1000 * ms;
        var minute = 60 * sec;
        var hour = 60 * minute;
        var day = 24 * hour;
        var week = 7 * day;

        if(time >= week){
            var weeks = round(time / week);
            return weeks+" week"+(weeks>1?"s":"");
        } else if(time >= day){
            var days = round(time / day);
            return days+" day"+(days>1?"s":"");
        } else if(time >= hour){
            var hours = round(time / hour);
            return hours+" hour"+(hours>1?"s":"");
        } else if(time >= minute){
            var mins = Math.floor(time / minute);
            return mins+" min"+(mins>1?"s":"");
        } else if(time >= sec){
            var secs = Math.floor(time / sec);
            return secs+" s";
        }

        return time+" ms";
    }

    function round(val){
        return Math.round(val*10)/10;
    }

    function truncateString(str, len){
        if(str.length <= len) return str;
        return str.substring(0,len-2)+"..";
    }

    function update(source) {
        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse(),
            links = tree.links(nodes);

        var minMoment = getMicroseconds(source.timestamp);
        var maxMoment = getMicroseconds(source.timestamp);
        // Normalize for fixed-depth.
        nodes.forEach(function(d) {
            d.y = d.depth * 180;
            if(getMicroseconds(d.timestamp) < minMoment){
                minMoment = getMicroseconds(d.timestamp)
            }
            if(getMicroseconds(d.timestamp) > maxMoment){
                maxMoment = getMicroseconds(d.timestamp)
            }
        });

        var timeScale = d3.scale.linear().domain([minMoment, maxMoment]).range([1,width]);

        var timeTransformNode = function(d, timeScaleFn){
            d.y = timeScaleFn(getMicroseconds(d.timestamp));
            return d;
        }

        // Update the nodes…
        var node = svg.selectAll("g.node")
            .data(nodes, function(d) { return d.id || (d.id = ++id); });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) {
                var origSource = {
                    x: source.x0,
                    y: source.y0,
                    timestamp: source.timestamp
                };
                var n = timeTransformNode(origSource, source.prevTimeScale);
                return "translate(" + n.y + "," + n.x + ")";
            })
            .on("mousedown", function(d){
                d.clickInProcess = true;
                setTimeout(function(){
                    if(d.clickInProcess){
                        d.clickInProcess = false;
                        longclick(d);
                    }
                },1500);
            })
            .on("mouseup", function(d){
                if(d.clickInProcess){
                    d.clickInProcess = false;
                    click(d);
                }
            })
            .on("mouseover", function(d){
                scope.selectedEvent = d.event;

                //add drop line
                var x = d.x;
                var y = d.y;
                d.dropline = svg.append('line')
                .attr('x1', function(d){ return y;})
                .attr('y1', function(d){ return x+7;})
                .attr('x2', function(d){ return y;})
                .attr('y2', function(d){ return height+25;})
                .attr('stroke','gray')
                .attr('stroke-dasharray','2,2')
                .attr('stroke-width','1');

                d.droplineText = svg.append("text")
                .attr("x", function(t) { return y; })
                .attr("y", function(t) { return height+70; })
                .attr("text-anchor", "middle")
                .attr("font-weight","bold")
                .text(function(t) { return new moment(d.timestamp).format("HH:mm:ss SSS"); });
            })
            .on("mouseout", function(d){
                if(d.dropline)
                    d.dropline.remove();
                if(d.droplineText)
                    d.droplineText.remove();
            });

        // Toggle children on click.
        function click(d) {
            if(d.children)
                d.children = null;
            else
                d.children = d._children;
            update(d);
        }

        // Make root node on long click.
        function longclick(d) {
            collapsibleTree.makeRootNode(d);
        }

        nodeEnter.append("circle")
            .attr("r", 1e-6)
            .style("fill", function(d) { return d._children ? "#2E9625" : "#fff"; });

        nodeEnter.append("text") //node name
            .attr("x", function(d) { return d._children ? -12 : 12; })
            .attr("dy", ".35em")
            .attr("class","node-name")
            .attr("text-anchor", function(d) { return d._children ? "end" : "start"; })
            .text(function(d) {
                var maxLength = 20;
                if(!d._parent || (d._parent && d._parent._children && d._parent._children.length==1)){ //root node or parent has a single child
                    maxLength = 14;
                }
                if(d.name.length > maxLength) return truncateString(d.name, maxLength);
                else return d.name;
            })
            .style("fill-opacity", 1e-6);

        nodeEnter.append("text") //timestamp
            .attr("x", function(d) { return d._children ? 12 : -12; })
            .attr("dy", ".35em")
            .attr("class","node-timestamp")
            .attr("text-anchor", "start")
            .text(function(d) {
                if(d.eventId == root.eventId){ //is root
                    return "[0 ms]";
                }else{
                    var rootMoment = moment(root.timestamp)
                    var currentMoment = moment(d.timestamp)
                    var diffMoment = currentMoment.diff(rootMoment);
                    return "["+formatTime(diffMoment)+"]";
                }

            })
            .style("fill-opacity", 1e-6);


        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) {
                var n = timeTransformNode(d, timeScale);
                return "translate(" + n.y + "," + n.x + ")";
            });

        nodeUpdate.select("circle")
            .attr("r", 7)
            .style("fill", function(d) { return (d._children && d._children.length>0) ? "#2E9625" : "#fff"; });

        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        nodeUpdate.selectAll(".node-timestamp")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) {
                var n = timeTransformNode(source, timeScale);
                return "translate(" + n.y + "," + n.x + ")";
            })
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        // Update the links…
        var link = svg.selectAll("path.link")
            .data(links, function(d) { return d.target.id; });

        var timeTransformLink = function(d, timeScaleFn){
            d.source.y = timeScaleFn(getMicroseconds(d.source.timestamp));
            d.target.y = timeScaleFn(getMicroseconds(d.target.timestamp));
            return d;
        }

        var diagonal = function(d){
            return "M" + d.source.y + "," + d.source.x
            + "C" + d.source.y +  "," + (d.source.x + d.target.x) / 2
            + " " + d.target.y + "," + (d.source.x + d.target.x) / 2
            + " " + d.target.y + "," + d.target.x;
        };

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("id", function(d){
                return d.source.id+":"+d.target.id;
            })
            .attr("d",function(d){
                var origSource = {
                    x: source.x0,
                    y: source.y0,
                    timestamp: source.timestamp
                };
                return diagonal(timeTransformLink({source: origSource, target: origSource},source.prevTimeScale));
            });

        link.transition()
            .duration(duration)
            .attr("d",function(d){
                return diagonal(timeTransformLink(d,timeScale));
            });

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
                return diagonal(timeTransformLink({source: source, target: source},timeScale));
            })
            .remove();

        link.on("mouseover", function(d){
            })

        d3.selectAll(".edge-label").remove();
        links.forEach(function (d){
            var sourceMoment = moment(d.source.timestamp)
            var targetMoment = moment(d.target.timestamp)
            var diffMoment = targetMoment.diff(sourceMoment);
            svg.append("text").attr("class","edge-label")
            .append("textPath")
            .attr("startOffset","40%")
            .attr("href", "#"+d.source.id+":"+d.target.id)
            .append("tspan")
            .attr("dy", function(){
                if(d.target.x > d.source.x) return "15";
                return "-15";
            })
            .text("+ "+formatTime(diffMoment));
        });

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
            d.prevTimeScale = timeScale;
        });

        d3.selectAll(".xaxis").remove();
        var xAxis = d3.svg.axis()
            .orient("bottom")
            .scale(timeScale)
            .ticks(5)
            .tickFormat(function(d){
                var dMs = d / 1000;
                var tmpMoment = new moment(dMs).format("YYYY-MM-DD HH:mm:ss SSS");
                return tmpMoment;
            });
        svg.append("g")
            .attr("class", "xaxis")
            .attr("transform", "translate(0," + (height+25) + ")")
            .attr("fill", "none")
            .call(xAxis);
    }

  return this;
}
