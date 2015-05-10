var Photoapp = function(config) {
  'use strict';

  var addWindowHandler, handleDetails, handlePhotos, buildRequestUrl, getImageUrl, defaultSort, titleSort, managePromise, manageOptions,
  self = this,
  defaults = {
    base: 'https://api.flickr.com/services/rest/?format=json',
    imageSize: 'd',
    sorts: []
  };

  addWindowHandler = function() {
    var originalMethod,
      handlers = {
        'flickr.photosets.getInfo': handleDetails,
        'flickr.photosets.getPhotos': handlePhotos
      };

      if (window.jsonFlickrApi) {
        originalMethod = window.jsonFlickrApi;
      }

      window.jsonFlickrApi = function(data) {
        if (data.photoset.id === self.options.photosetId) {
          handlers[self.options.method](data);
        }
      };

      if (originalMethod) {
        originalMethod(data);
      }
  };

  buildRequestUrl = function() {
    var o = self.options;
    return [o.base, '&method=', o.method, '&photoset_id=', o.photosetId, '&user_id=', o.userId, '&api_key=', o.apiKey].join('');
  };

  this.getPhotosetDetails = function() {
    self.options.method = 'flickr.photosets.getInfo';

    $.ajax(buildRequestUrl());
  };

  this.getPhotos = function() {
    self.options.method = 'flickr.photosets.getPhotos';

    $.ajax(buildRequestUrl());
  };

  handleDetails = function(data) {
    self.viewModel.title(data.photoset.title._content);
    self.viewModel.description(data.photoset.description._content);

    self.promise.resolve();
  };

  handlePhotos = function(data) {
    var x, model, baseObj,
    y = data.photoset.total,
    models = [];

    // Store photos
    for (x = 0; x < y; x++) {
      model = {};
      baseObj = data.photoset.photo[x];
      baseObj.size = self.options.imageSize;

      model.url = getImageUrl(baseObj);
      model.title = baseObj.title;
      model.originalIndex = x;

      models.push(model);
    }

    self.viewModel.photos(models);
  };

  getImageUrl = function(photo) {
    return ['http://farm', photo.farm, '.staticflickr.com/', photo.server, '/', photo.id, '_', photo.secret, '_', photo.size, '.jpg'].join('');
  };
  
  defaultSort = function() {
    self.viewModel.photos.sort(function(l,r) {
      return l.originalIndex === r.originalIndex ? 0 : l.originalIndex < r.originalIndex ? -1 : 1;
    });
  };

  titleSort = function() {
    self.viewModel.photos.sort(function(l,r) {
      // console.log(l);
      return l.title === r.title ? 0 : l.title < r.title ? -1 : 1;
    });
  };

  managePromise = function() {
    self.promise = $.Deferred();
    $.when(self.promise).then(self.getPhotos);
  };

  manageOptions = function() {
    self.options = $.extend(defaults, config);
    
    // Note: unshift adds items to the start of an array
    self.options.sorts.unshift(
      { name: 'default', sorter: defaultSort}, 
      { name: 'title', sorter: titleSort});
  };

  return (function() {
    manageOptions();
    managePromise();
    addWindowHandler();
    self.getPhotosetDetails();

    self.viewModel = {
      title: ko.observable(),
      description: ko.observable(),
      photos: ko.observableArray([]),
      sorts: ko.observableArray(self.options.sorts),
      sortHandler: function(item, event) {
        item.sorts()[event.target.selectedIndex].sorter();
      },
      stopEditing: function() {
        $('[contentEditable]').removeAttr('contenteditable');
      },
      makeEditable: function(item, event) {
        self.viewModel.stopEditing();
        $(event.target).attr('contenteditable', true);
      }
    };

    ko.applyBindings(self.viewModel);
  })();
};
