/*global angular */

/**
 * @ngdoc directive
 * @name TatUi.directive:messagesItem
 * @restrict AE
 * @description
 * display a route message
 */
angular.module('TatUi').directive('messagesPastatviewItem', function($compile) {
  'use strict';

  return {
    restrict: 'E',
    scope: {
      message: '=',
      topic: '=',
      isTopicDeletableMsg: '=',
      isTopicUpdatableMsg: '=',
      isTopicDeletableAllMsg: '=',
      isTopicUpdatableAllMsg: '=',
      isTopicRw: '='
    },
    replace: true,
    templateUrl: '../build/tatwebui-plugin-pastatview/pastatview/list/pastatview-item.directive.html',
    controllerAs: 'ctrl',
    /**
     * @ngdoc controller
     * @name TatUi.controller:messagesItem
     * @requires TatUi.Authentication       Tat Authentication
     * @requires TatUi.TatEngineMessageRsc  Tat Engine Resource Message
     * @requires TatUi.TatEngine            Global Tat Engine service
     *
     * @description Directive controller
     */
    controller: function($scope, $rootScope, TatEngineMessageRsc,
      TatEngineMessagesRsc, TatEngine, TatMessage, Authentication) {
      var self = this;
      this.answerPanel = false;

      this.getBrightness = function(rgb) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(rgb);
        return result ?
          0.2126 * parseInt(result[1], 16) +
          0.7152 * parseInt(result[2], 16) +
          0.0722 * parseInt(result[3], 16) : 0;
      };

      /**
       * @ngdoc function
       * @name deleteMessage
       * @methodOf TatUi.controller:messagesItem
       * @description delete a message from a Private topic
       */
      this.deleteMessage = function(message) {
        TatEngineMessageRsc.delete({
          'idMessageToDelete': message._id,
          'cascade': 'cascade/'
        }).$promise.then(function(resp) {
          TatEngine.displayReturn(resp);
          message.hide = true;
          message.displayed = false;
        }, function(response) {
          TatEngine.displayReturn(response);
        });
      };

      /**
       * @ngdoc function
       * @name updateMessage
       * @methodOf TatUi.controller:messagesItem
       * @description Update a message
       */
      this.updateMessage = function(message) {
        message.updating = false;
        TatEngineMessageRsc.update({
          'topic': $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
          'idReference': message._id,
          'text': message.text,
          'action': 'update',
        }).$promise.then(function(resp) {
          message.text = resp.message.text;
        }, function(resp) {
          message.updating = true;
          TatEngine.displayReturn(resp);
        });
      };

      /**
       * @ngdoc function
       * @name hasLiked
       * @methodOf TatUi.controller:messagesItem
       * @description Define if the message is marked 'like'
       * @return {bool} If true, 'like'
       */
      this.hasLiked = function(message) {
        if (message && message.likers) {
          return _.includes(message.likers, Authentication.getIdentity().username);
        }
        return false;
      };

      /**
       * @ngdoc function
       * @name toggleLikeMessage
       * @methodOf TatUi.controller:messagesItem
       * @description toggle 'like' state on the message
       *
       */
      this.toggleLikeMessage = function(message) {
        var action = self.hasLiked(message) ? 'unlike' : 'like';
        TatEngineMessageRsc.update({
          'topic': $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
          'idReference': message._id,
          'action': action
        }).$promise.then(function(resp) {
          if (action === 'like') {
            if (!message.likers) {
              message.likers = [];
            }
            message.likers.push(Authentication.getIdentity().username);
            message.nbLikes++;
          } else {
            message.likers = _.remove(message.likers,
              Authentication.getIdentity().username);
            message.nbLikes--;
          }
        }, function(err) {
          TatEngine.displayReturn(err);
        });
      };

      /**
       * @ngdoc function
       * @name removeLabel
       * @methodOf TatUi.controller:messagesItem
       * @description remove a label
       * @param {object} message Message on which to add a label
       * @param {object} label   Label {text} to remove
       */
      this.removeLabel = function(message, labelText) {
        if (!message.labels) {
          return;
        }
        var toRefresh = false;
        var newList = [];
        for (var i = 0; i < message.labels.length; i++) {
          var l = message.labels[i];
          if (l.text === labelText || (labelText === 'doing' && l.text.indexOf('doing:') === 0)) {
            toRefresh = true;
            TatEngineMessageRsc.update({
              'action': 'unlabel',
              'topic': $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
              'idReference': $scope.message._id,
              'text': l.text
            }).$promise.then(function(resp) {
              //nothing here
            }, function(resp) {
              TatEngine.displayReturn(resp);
            });
          } else {
            newList.push(l);
          }
        }

        if (toRefresh)  {
          message.labels = newList;
        }
      };

      this.urlMessage = function(message) {
        $rootScope.$broadcast('topic-change', {
          topic: $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
          idMessage: message._id,
          reload: true
        });
      };

      this.getLanguage = function(message) {
        if (!message.tags) {
          return "bash";
        }
        for (var i = 0; i < message.tags.length; i++) {
          if (message.tags[i].indexOf("language:") === 0) {
            return message.tags[i].substr(9);
          }
        }
        return "bash";
      };

      this.init = function(message) {
        message.loading = true;
        return TatEngineMessagesRsc.list({
          topic: $scope.topic.topic.indexOf("/") === 0 ? $scope.topic.topic.substr(1) : $scope.topic.topic,
          treeView: "onetree",
          idMessage: message._id,
          limit: 1,
          skip: 0
        }).$promise.then(function(data) {
          message.loading = false;
          if (!data.messages || data.messages.length != 1) {
            TatEngine.displayReturn("Invalid return while getting message");
          } else {
            message.replies = data.messages[0].replies;
            if (message.replies && message.replies.length > 0) {
              message.replies.sort(function(a, b) {
                if (a.dateCreation > b.dateCreation) {
                  return 1;
                }
                if (a.dateCreation < b.dateCreation) {
                  return -1;
                }
                return 0;
              });
            }
          }
        }, function(err) {
          message.loading = false;
          TatEngine.displayReturn(err);
        });
      };

      this.init($scope.message);

    }
  };
});
