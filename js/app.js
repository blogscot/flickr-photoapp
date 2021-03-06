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
    var epoch = parseInt(data.photoset.date_update, 10),
        d = new Date(0),
        short = [];

    d.setUTCSeconds(epoch);
    short.push(d.getDate(), d.getMonth() + 1, d.getFullYear());

    self.viewModel.title(data.photoset.title._content);
    self.viewModel.description(data.photoset.description._content);
    self.viewModel.date(short.join('/'));

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
    self.viewModel.originalLength = models.length;
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
      date: ko.observable(),
      showButton: ko.observable(false),
      lightboxVisible: ko.observable(false), 
      lightbox: {
        title: null,
        url: null,
      },
      filterTerm: ko.observable(),
      originalPhotos: null,
      originalLength: 0,
      sorts: ko.observableArray(self.options.sorts),
      sortHandler: function(item, event) {
        item.sorts()[event.target.selectedIndex].sorter();
      },
      stopEditing: function() {
        $('[contentEditable]').removeAttr('contenteditable');
        self.viewModel.showButton(false);        
      },
      makeEditable: function(item, event) {
        self.viewModel.stopEditing();
        $(event.target).attr('contenteditable', true);
      },
      serialise: function() {
        var data = ko.toJS(self.viewModel);

        delete data.showButton;
        delete data.sorts;
        delete data.titleAndDate;

        data = JSON.stringify(data);
        // this could be extended to send the JSON data back to the server.
      },
      showLightbox: function(photo) {
        self.viewModel.lightbox.url = photo.url.replace(/_d/, '_b');
        self.viewModel.lightbox.title = photo.title;
        self.viewModel.lightboxVisible(true);
      },
      closeLightbox: function() {
        self.viewModel.lightbox.url = null;
        self.viewModel.lightbox.title = null;
        self.viewModel.lightboxVisible(false);
      },
    };

    self.viewModel.titleAndDate = ko.computed(function() {
      return self.viewModel.title() + " " + self.viewModel.date();
    });

    self.viewModel.filter = ko.computed(function() {
      var x,
          y = self.viewModel.photos().length,
          results = [],
          vm = self.viewModel,
          term = vm.filterTerm();

          // find filter term matches
          if(term !== undefined && term !== '') {
            
            for (x = 0; x < y; x++) {
              var lowerCaseTitle = vm.photos()[x].title.toLowerCase();
              if (lowerCaseTitle.indexOf(term.toLowerCase()) !== -1 ) {
                results.push(vm.photos()[x]);
              }
            }
            if (vm.photos().length === vm.originalLength) {
              vm.originalPhotos = vm.photos();
            }
            vm.photos(results);
          } else if (term === '') {
            // Reset the list
            vm.photos(vm.originalPhotos);
          }
    });

    ko.bindingHandlers.editableContent = {
      init: function(element, valueAccessor) {
        var editable = $(element),
            tagName = element.tagName;

        editable.on('blur', function() {
          var index,
              text = editable.text(),
              observable = valueAccessor();

          if (tagName !== 'SPAN') {
            // title is an observable
            observable(text);
          } else {
            // figurecaption title is an normal JS element 
            index = editable.closest('figure').index();
            self.viewModel.photos()[index].title = text;
          }

          self.viewModel.showButton(true);        

        });
      },
      update: function(element, valueAccessor) {
        var val = valueAccessor();
        // unwrap any observable values
        val = ko.utils.unwrapObservable(val);
        $(element).text(val);
        
      }
    };

    ko.applyBindings(self.viewModel);
  })();
};
