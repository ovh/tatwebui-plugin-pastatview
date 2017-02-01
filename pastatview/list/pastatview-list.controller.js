/*global angular,_,moment */

/**
 * @ngdoc controller
 * @name TatUi.controller:MessagesPastatViewListCtrl
 * @requires TatUi.TatEngineMessagesRsc Tat Engine Resource Messages
 * @requires TatUi.TatEngineMessageRsc  Tat Engine Resource Message
 * @requires TatUi.TatEngine            Global Tat Engine service
 *
 * @description List Messages controller
 */
angular.module('TatUi')
  .controller('MessagesPastatViewListCtrl', function(
    $scope,
    $rootScope,
    $stateParams,
    Authentication,
    TatEngineMessagesRsc,
    TatEngineMessageRsc,
    TatEngineTopicRsc,
    TatEngine,
    TatFilter,
    TatTopic,
    Flash,
    $translate,
    $interval,
    $location
  ) {
    'use strict';

    var self = this;
    self.filter = TatFilter.getCurrent();
    self.topic = $stateParams.topic;
    self.filterDialog = { x: 380, y: 62, visible: false };

    self.data = {
      messages: [],
      requestFrequency: 5000,
      count: 30,
      skip: 0,
      isTopicDeletableMsg: false,
      isTopicDeletableAllMsg: false,
      isTopicUpdatableMsg: false,
      isTopicUpdatableAllMsg: false,
      isTopicRw: true,
      displayMore: true,
      showCreate: false,
      contentSnippet: "",
      titleSnippet: "",
      baseHref: null,
      isFirst: true,
      initialLoading: false
    };

    $scope.$on('filter-changed', function(ev, filter){
      self.data.skip = 0;
      self.data.displayMore = true;
      self.filter = angular.extend(self.filter, filter);
      self.refresh();
    });

    self.getCurrentDate = function() {
      return moment().format('YYYY/MM/DD-HH:MM');
    };

    self.currentDate = self.getCurrentDate();

    /**
     * @ngdoc function
     * @name loadMore
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Try to load more messages
     */
    self.loadMore = function() {
      if (!self.loading) {
        self.moreMessage();
      }
    };

    self.getBrightness = function(rgb) {
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(rgb);
      return result ?
        0.2126 * parseInt(result[1], 16) +
        0.7152 * parseInt(result[2], 16) +
        0.0722 * parseInt(result[3], 16) : 0;
    };

    /**
     * @ngdoc function
     * @name mergeMessages
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Merge messages in the current message list
     * @param {string} messages Message list to merge
     */
    self.mergeMessages = function(dest, source) {
      if (source && _.isArray(source)) {
        for (var i = 0; i < source.length; i++) {
          var origin = _.find(dest, {
            _id: source[i]._id
          });
          if (origin) {
            if (!origin.replies) {
              origin.replies = [];
            }
            self.mergeMessages(origin.replies, source[i].replies);
            origin.labels = source[i].labels;
            origin.likers = source[i].likers;
            origin.nbLikes = source[i].nbLikes;
            origin.tags = source[i].tags;
          } else {
            if (!self.data.intervalTimeStamp) {
              self.data.intervalTimeStamp = source[i].dateUpdate;
            } else if (source[i].dateUpdate > self.data.intervalTimeStamp) {
              self.data.intervalTimeStamp = source[i].dateUpdate;
            }
            dest.push(source[i]);
          }
        }
      }
      TatFilter.sortMessages(dest);
      return dest;
    };

    /**
     * @ngdoc function
     * @name beginTimer
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Launch the timer to request messages at regular time interval
     */
    self.beginTimer = function() {
      self.data = angular.extend(self.data, TatTopic.getDataTopic());
      var timeInterval = self.data.requestFrequency;
      if ('undefined' === typeof self.data.timer) {
        self.getNewMessages(true); // Don't wait to execute first call
        self.data.timer = $interval(self.getNewMessages, timeInterval);
        $scope.$on("$destroy", function() { self.stopTimer(); });
      }
    };

    /**
     * @ngdoc function
     * @name stopTimer
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Stop the time that request messages at regular time interval
     */
    self.stopTimer = function() {
      $interval.cancel(self.data.timer);
      self.data.timer = undefined;
    };

    self.getBaseHRef = function() {
      if (self.data.baseHref) {
        return self.data.baseHref;
      }
      var bases = document.getElementsByTagName('base');
      if (bases.length > 0) {
        self.data.baseHref = bases[0].href;
      }
      return self.data.baseHref;
    };

    self.getUrlMessage = function(message) {
      return self.getBaseHRef() + "pastatview/list" + self.data.topic.topic+"?idMessage=" + message._id;
    };

    self.urlMessage = function(e, message) {
      e.preventDefault();
      self.data.isFirst = true;
      TatFilter.setFilters({idMessage: message._id}).search();
    };

    /**
     * @ngdoc function
     * @name buildFilter
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Build a filter to read messages
     * @param {object} data Custom data to send to the API
     * @return {object} Parameters to pass to the API
     */
    self.buildFilter = function(data) {
      return angular.extend({}, data, self.filter);
    };

    /**
     * @ngdoc function
     * @name getNewMessages
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Request for new messages
     */
    self.getNewMessages = function() {
      if (self.loading) {
        console.log("messages list already in refresh...");
        return;
      }
      self.loading = true;
      self.currentDate = self.getCurrentDate();
      var filterAttrs = {
        topic: self.topic,
        treeView: 'notree',
        onlyMsgRoot: true
      };
      if (!TatFilter.containsDateFilter) {
        filterAttrs.dateMinUpdate = self.data.intervalTimeStamp;
      }
      var filter = self.buildFilter(filterAttrs);
      return TatEngineMessagesRsc.list(filter).$promise.then(function(data) {
        self.digestInformations(data);
      }, function(err) {
        TatEngine.displayReturn(err);
        self.loading = false;
      });
    };

    self.getReplies = function(msg) {
      msg.displayReplies = !msg.displayReplies;
      if (!msg.displayReplies) {
        return;
      }

      return TatEngineMessagesRsc.list({
        topic: self.topic,
        treeView: "onetree",
        idMessage: msg._id,
        limit: 1,
        skip: 0
      }).$promise.then(function(data) {
        if (!data.messages || data.messages.length != 1) {
          TatEngine.displayReturn("invalid return while getting message");
        } else {
          msg.replies = data.messages[0].replies;
        }
      }, function(err) {
        TatEngine.displayReturn(err);
      });
    };

    /**
     * @ngdoc function
     * @name moreMessage
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Request more messages
     * @return {object} Promise
     */
    self.moreMessage = function() {
      self.loading = true;
      var filter = self.buildFilter({
        topic: self.topic,
        treeView: 'notree',
        onlyMsgRoot: true,
        limit: self.data.count,
        skip: self.data.skip
      });
      return TatEngineMessagesRsc.list(filter).$promise.then(function(data) {
        if (!data.messages) {
          self.data.displayMore = false;
        } else {
          self.data.skip = self.data.skip + self.data.count;
          self.digestInformations(data);
        }
      }, function(err) {
        TatEngine.displayReturn(err);
        self.loading = false;
      });
    };

    /**
     * @ngdoc function
     * @name digestInformations
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description
     * @return
     */
    self.digestInformations = function(data) {
      self.data.isTopicRw = data.isTopicRw;
      if (_.includes(Authentication.getIdentity().favoritesTopics, '/' + self.topic)) {
        self.data.isFavoriteTopic = true;
      }
      self.data.messages = self.mergeMessages(self.data.messages, data.messages);
      self.loading = false;
      if (self.data.isFirst === true) {
        self.data.isFirst = false;
        var cur = TatFilter.getCurrent();
        if (cur && cur.idMessage && cur.idMessage !== "") {
          self.toggleMessage(self.data.messages[0]);
        }
      }
      self.data.initialLoading = false;
    };

    /**
     * @ngdoc function
     * @name init
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Initialize list messages page. Get list of messages from Tat Engine
     */
    self.init = function() {
      self.data.initialLoading = true;
      TatTopic.computeTopic(self.topic, self.beginTimer);
    };

    /**
     * @ngdoc function
     * @name refresh
     * @methodOf TatUi.controller:MessagesPastatViewListCtrl
     * @description Refresh all the messages
     */
    self.refresh = function() {
      self.data.currentTimestamp = Math.ceil(new Date().getTime() / 1000);
      self.data.messages = [];
      self.moreMessage();
    };

    self.setMessage = function(message) {
      message.displayed = true;
      $scope.message = message;
    };

    self.toggleMessage = function(message) {
      var same = false;
      if ($scope.message && $scope.message._id == message._id) {
        same = true;
      }
      if ($scope.message && $scope.message.displayed) {
        self.closeMessage($scope.message);
        setTimeout(function() {
          $scope.$apply(function() {
            if (!same) {
              self.setMessage(message);
            }
          });
        }, 100);
      } else {
        self.setMessage(message);
      }
    };

    self.closeMessage = function(message) {
      TatFilter.setFilters({idMessage: null}).search();
      $scope.message.displayed = false;
      $scope.message = null;
      self.data.isFirst = true;
    };

    self.sendWrite = function() {
        if (self.data.titleSnippet === "" || self.data.contentSnippet === "") {
          Flash.create('danger', $translate.instant('message_pastatview_new_snippet_invalid'));
          return;
        }

        self.data.showCreate = false;

        TatEngineMessageRsc.create({
          text: self.data.titleSnippet,
          topic: self.topic
        }).$promise.then(function(data) {
          if (!data || !data.message || !data.message._id) {
            Flash.create('danger', 'Error while send title');
            return;
          }
          self.data.messages.unshift(data.message);
          TatEngineMessageRsc.create({
            text: self.data.contentSnippet,
            topic: self.topic,
            idReference: data.message._id,
          }).$promise.then(function(dataReply) {
            self.data.titleSnippet = "";
            self.data.contentSnippet = "";
            data.message.nbReplies=1;
            //data.message.replies.unshift(dataReply.message);
            self.toggleMessage(data.message);
          }, function(err) {
            TatEngine.displayReturn(err);
          });
        }, function(err) {
          TatEngine.displayReturn(err);
        });
    };

    self.cancelWrite = function() {
      self.data.showCreate = false;
      self.data.titleSnippet = "";
      self.data.contentSnippet = "";
    };

    self.addLanguage = function(e, langage) {
      e.preventDefault();
      var re = new RegExp(' #language:\\w*','g');
      self.data.titleSnippet = self.data.titleSnippet.replace(re, "");
      self.data.titleSnippet += " #language:" + langage;
    };

    self.suggestTags = function (term) {
      if (!self.data.topic.tags) {
        return [];
      }
      var q = term.toLowerCase().trim();
      var results = [];
      for (var i = 0; i < self.data.topic.tags.length && results.length < 10; i++) {
        var tag = self.data.topic.tags[i];
        if (tag.toLowerCase().indexOf(q) === 0) {
          results.push({ label: "#" + tag, value: tag });
        }
      }
      return results;
    };

    self.suggest = function (term, fnc) {
      var ix = term.lastIndexOf('#');
      if (ix == -1) {
        return [];
      }
      var lhs = term.substring(0, ix + 1),
          rhs = term.substring(ix + 1),
          suggestions = fnc(rhs);
      suggestions.forEach(function (s) {
        s.value = lhs + s.value;
      });
      return suggestions;
    };

    self.suggestTagsDelimited = function (term) {
      if (!self.topic || !self.topic.topic) {
        return;
      }
      return self.suggest(term, self.suggestTags);
    };

    $scope.autocompleteOptionsTags = {
      suggest: self.suggestTagsDelimited,
    };

    self.init();
  });
