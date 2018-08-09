define(['angular'], function (angular) {'use strict'; (function(module) {
try {
  module = angular.module('es-ui.visualize.templates');
} catch (e) {
  module = angular.module('es-ui.visualize.templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('visualize.eventflow.tpl.html',
    '<style>.node {\n' +
    '	  cursor: pointer;\n' +
    '	}\n' +
    '\n' +
    '	.node circle {\n' +
    '	  fill: #fff;\n' +
    '	  stroke: #2E9625;\n' +
    '	  stroke-width: 1.5px;\n' +
    '	}\n' +
    '\n' +
    '	.node text {\n' +
    '	  font: 14px sans-serif;\n' +
    '	}\n' +
    '\n' +
    '	.link {\n' +
    '	  fill: none;\n' +
    '	  stroke: #ccc;\n' +
    '	  stroke-width: 1.5px;\n' +
    '	}\n' +
    '\n' +
    '	.arrow{\n' +
    '		stroke-width:8;\n' +
    '		stroke:#000;\n' +
    '	}\n' +
    '\n' +
    '	.tree_path{\n' +
    '		font-size: 20px;\n' +
    '		font-weight: bold;\n' +
    '		margin-top: 10px;\n' +
    '		margin-bottom: 10px;\n' +
    '		padding: 6px 20px 6px 20px;\n' +
    '	}\n' +
    '\n' +
    '	.tree_path_separator{\n' +
    '		width: 40px;\n' +
    '		float: left;\n' +
    '		font-weight: bold;\n' +
    '		text-align: center;\n' +
    '	}\n' +
    '\n' +
    '	#canvas{\n' +
    '		width: 100%;\n' +
    '		height: 600px;\n' +
    '	}\n' +
    '\n' +
    '	.input_controls{\n' +
    '		width: 400px;\n' +
    '		float: left;\n' +
    '	}\n' +
    '\n' +
    '	.input_controls div{\n' +
    '		margin-bottom: 10px;\n' +
    '	}\n' +
    '\n' +
    '	.input_controls label{\n' +
    '		width: 140px;\n' +
    '	}\n' +
    '\n' +
    '	.tips{\n' +
    '		float:right;\n' +
    '		width: 400px;\n' +
    '	}\n' +
    '\n' +
    '	.tips ul{\n' +
    '		margin: 0;\n' +
    '		padding: 0;\n' +
    '	}\n' +
    '\n' +
    '	.event-details{\n' +
    '		width: 350px;\n' +
    '		float: left;\n' +
    '	}\n' +
    '\n' +
    '	.event-data{\n' +
    '		float: left;\n' +
    '		width: 350px;\n' +
    '	}\n' +
    '\n' +
    '	.event-data pre{\n' +
    '		background: #FCFCCF;\n' +
    '		height: 130px;\n' +
    '		overflow:scroll;\n' +
    '	}\n' +
    '\n' +
    '	.edge-label{\n' +
    '		font-size: 10px;\n' +
    '	}\n' +
    '	.node-timestamp{\n' +
    '		font-size: 10px !important;\n' +
    '	}\n' +
    '\n' +
    '	.node-name{\n' +
    '		font-size: 13px !important;\n' +
    '	}\n' +
    '\n' +
    '	.xaxis line{\n' +
    '	stroke: #2E9625;\n' +
    '	stroke-width: 1px;\n' +
    '	}\n' +
    '\n' +
    '	.xaxis path{\n' +
    '	stroke: #2E9625;\n' +
    '	stroke-width: 1px;\n' +
    '	}\n' +
    '\n' +
    '	.xaxis text{\n' +
    '	fill:black;\n' +
    '	}\n' +
    '\n' +
    '	.projection-status-Running{\n' +
    '		color: green\n' +
    '	}\n' +
    '\n' +
    '	.projection-status-Stopped{\n' +
    '		color: red\n' +
    '	}\n' +
    '\n' +
    '	.visualize-form-table{\n' +
    '		border: 0;\n' +
    '	}\n' +
    '\n' +
    '	.visualize-form-table tbody td {\n' +
    '		border: 0;\n' +
    '	}</style><header></header><div class=input_controls><h2>Event Flow Visualization</h2><form><table border=0 class=visualize-form-table><tr><td><label for=correlation_id_prop>Correlation ID property:</label></td><td><input class=input_control id=correlation_id_property value=$correlationId disabled=true></td></tr><tr><td><label for=caused_by_prop>Caused By property:</label></td><td><input class=input_control id=caused_by_property ng-model=causedByProperty></td></tr><tr><td><label for=correlation_id>Correlation ID:</label></td><td><input class=input_control id=correlation_id ng-model=correlationId></td></tr><tr><td colspan=2><input type=submit ng-click=go() value="Let\'s go!"></td></tr></table></form></div><div class=event-details ng-if=selectedEvent><h2>Event Details</h2><div><div><strong>Type:</strong> {{selectedEvent.eventType}}</div><div><strong>Timestamp:</strong> {{selectedEvent.updated}}</div><div><strong>Event ID:</strong> {{selectedEvent.eventId}}</div><div><strong>Link:</strong> <a target=_blank href={{selectedEvent.id}}>{{selectedEvent.id}}</a></div></div></div><div class=event-data ng-if=selectedEvent><h2>Event Data</h2><pre>{{selectedEvent.data}}</pre></div><div class=tips><h2>Some tips to get started</h2><ul><li>Make sure that the <strong>$by_correlation_id</strong> projection is running.<br><strong>Current status: <span class=projection-status-{{projectionStatus}}>{{projectionStatus}}</span> <button ng-if="projectionStatus==\'Stopped\'" ng-click=startProjection()>Start</button></strong></li><li>Enter the <strong>Correlation ID</strong> of the event flow you want to visualize</li><li>Click on green events <svg height=12 width=12><circle cx=6 cy=6 r=5 fill="#2E9625"></svg> to expand</li><li>Hover on events to see the event details</li><li>Hold your click on any event for 2 seconds make it the root node</li></ul></div><div style=clear:both></div><div class=tree_path><span ng-repeat="node in tree.path"><div class=tree_path_separator ng-if="$index > 0">></div><div style="float: left" ng-click=tree.makeRootNode(node)><a href=javascript:;>{{ node.name }}</a></div></span><div style=clear:both></div></div><div class=tree_controls><button ng-disabled=collapsingNodes ng-click=tree.collapseAll()>Collapse all</button> <button ng-disabled=collapsingNodes ng-click=tree.expandAll()>Expand all</button> <button ng-disabled=collapsingNodes ng-click=tree.smartCollapse()>Smart Collapse</button> <span ng-if=collapsingNodes><strong>Collapsing nodes for a better viewing experience...</strong></span></div><div id=canvas></div>');
}]);
})();

(function(module) {
try {
  module = angular.module('es-ui.visualize.templates');
} catch (e) {
  module = angular.module('es-ui.visualize.templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('visualize.tpl.html',
    '<div ui-view></div>');
}]);
})();
 });