/*global angular*/
angular.module('TatUi').config(function($stateProvider, PluginProvider) {
  'use strict';

  PluginProvider.addPlugin({
    'name': 'Pastat View',
    'route': 'pastatview-list',
    'type': 'messages-views',
    'default': false
  });

  $stateProvider.state('pastatview-list', {
    url: '/pastatview/list/{topic:topicRoute}?idMessage&filterInLabel&filterAndLabel&filterNotLabel&filterInTag&filterAndTag&filterNotTag',
    templateUrl: '../build/tatwebui-plugin-pastatview/pastatview/list/pastatview-list.view.html',
    controller: 'MessagesPastatViewListCtrl',
    controllerAs: 'ctrl',
    reloadOnSearch: false,
    translations: [
      'plugins/tatwebui-plugin-pastatview/pastatview'
    ]
  });
});
