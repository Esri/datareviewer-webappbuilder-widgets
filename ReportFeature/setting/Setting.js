define([
    'dojo/_base/declare',
    'dojo/_base/array',
    'dojo/_base/lang',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/SimpleTable',
    'dojo/_base/html',
    'dojo/query',
    'dojo/on',
    'esri/tasks/datareviewer/ReviewerResultsTask',
    'jimu/dijit/Message',
    'dijit/form/ValidationTextBox',
    'dijit/form/RadioButton'
  ],
  function(
    declare, array, lang,
    _WidgetsInTemplateMixin,
    BaseWidgetSetting, Table, html, query , on, ReviewerResultsTask, Message) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'drs-widget-report-feature-setting',
      includeUserBy:'',
      defaultUserName:'',
      startup: function() {
        this.inherited(arguments);
        if (!this.config.layers) {
          this.config.layers = [];
        }

        var fields = [{
          name: 'label',
          title: this.nls.label,
          width: '40%',
          type: 'text'
        },
         {
          name: 'id',
          title: 'index',
          type: 'text',
          hidden: true
        }, {
          name: 'alias',
          title: this.nls.alias,
          type: 'text',
          width: '40%',
          editable: 'true',
          'class': 'symbol'
        }, {
          name: 'show',
          title: this.nls.show,
          width: 'auto',
          type: 'checkbox',
          'class': 'show'
        }, {
          name: 'layerType',
          title: 'layerType',
          type: 'text',
          hidden: true
        }, {
          name: 'url',
          title: 'url',
          type: 'text',
          hidden: true
        }
        ];
        this._setUserNameVisibility(false);
        on(this.defaultUser, "change", lang.hitch(this, this._setUserNameVisibility));
        var args = {
          fields: fields,
          selectable: true
        };
        this.displayFieldsTable = new Table(args);
        this.displayFieldsTable.placeAt(this.tableLayerInfos);
        html.setStyle(this.displayFieldsTable.domNode, {
          'height': '100%'
        });
        this.displayFieldsTable.startup();
        this.setConfig(this.config);
      },
      _setUserNameVisibility: function(checked){
        var userNameRow = query(this.userNameSettings);
        if (checked){
          this.set('includeUserBy', 'default');
          userNameRow.style({'display':'block'});
          this.showHideDynamicRows(true, this.userNameSettings);
        }
        else{
          this.showHideDynamicRows(false, this.userNameSettings);
        }
      },
      showHideDynamicRows:function(bShowHide){
        var dynamicRows = query('.dynamicRow');
        if(dynamicRows !== undefined && dynamicRows !== null && dynamicRows.length > 0){
          for(var i = 0; i < dynamicRows.length; i++){
            if(bShowHide){
              dynamicRows[i].style.display = '';
            }else {
              dynamicRows[i].style.display = 'none';
            }
          }
        }
      },
      setConfig: function(config) {
        this.config = config;
        var layerIds = [];
        var layerNames = [];
        this.populateSessionNames(this.config.drsUrl);
        if (config.drsUrl) {
          this.drsUrl.set('value', config.drsUrl);
        }
        array.forEach(config.layers, function(layer) {
          layerIds.push(layer.id);
          layerNames.push(layer.label || layer.id);
        });
        if (config.includeReportedBy === "" || config.includeReportedBy === "logon") {
          this.currentLogin.set('checked', true);
        }
        else if (config.includeReportedBy === "default"){
          this.defaultUser.set('checked', true);
          this.defaultUserName.set('value', config.defaultUserName);
        }
        else if (config.includeReportedBy === "user"){
          this.allowUser.set('checked', true);
        }
        var operationallayers = this.map.itemInfo.itemData.operationalLayers;
        for (var i = 0; i < operationallayers.length; i++) {
          var layer = operationallayers[i];
          if (layer.hasOwnProperty("url") && layer.url.indexOf("MapServer") > 0 ||
          layer.layerType === "ArcGISFeatureLayer") {
            var alias, show, layerType = "ArcGISMapServiceLayer";
            alias =  this.isLayerInConfig(layer, "alias");
            show = this.isLayerInConfig(layer, "show");
            if (layer.layerType){
              layerType = layer.layerType;
            }
            this.displayFieldsTable.addRow({
            label: layer.title,
            id: layer.id,
            alias: alias === "" ? layer.title : alias,
            show: show === "" ? true : show,
            layerType: layerType,
            url: layer.url
          });
          }
        }
      },
      _onBtnSetSourceClicked: function (){
        this.populateSessionNames(this.drsUrl.value);
      },
      populateSessionNames: function(drsURL){
        this.defaultSessionSelect.options.length = null;
        var reviewerTask = new ReviewerResultsTask(drsURL);
        var sessionsDeferred = reviewerTask.getReviewerSessions();
        sessionsDeferred.then(lang.hitch(this, function(response) {
        var reviewerSessions = response.reviewerSessions;
        array.forEach(reviewerSessions, lang.hitch(this, function(session) {
          var option = {value: session.sessionId, label: session.toString()};
          this.defaultSessionSelect.addOption(option);
        }));
        if (this.config.sessionID){
          this.defaultSessionSelect.set("value", this.config.sessionID.toString());
        }
      }));},
      isLayerInConfig: function(layer, infoType) {
        if (this.config.layers) {
          var info = this.config.layers;
          var len = info.length;
          for (var i = 0; i < len; i++) {
            if (info[i].id.toLowerCase() === layer.id.toLowerCase()){
              if (infoType === "show"){
                return info[i].show;
              }
              else if (infoType === "alias"){
                return info[i].alias;
              }
            }
          }
        }
        return "";
      },

      // check that user supplied required fields
      // (DRS url and layer ids)
      // build array of layer objects from the strings
      getConfig: function() {
        if (!this.drsUrl.value) {
          new Message({
            message: this.nls.warning
          });
          return false;
        }
        this.config.drsUrl = this.drsUrl.value;
        this.config.sessionID = this.defaultSessionSelect.value;
        var data = this.displayFieldsTable.getData();
        //var len = this.featurelayers.length;
        this.config.layers = [];

        var layerInfos = [];
        var len = data.length;
        for (var i = 0; i < len; i++) {
          var layer = {};
          layer.label = data[i].label;
          layer.id = data[i].id;
          layer.alias = data[i].alias;
          layer.show = data[i].show;
          layer.layerType = data[i].layerType;
          layer.url = data[i].url;
          layerInfos.push(layer);
        }
        this.config.layers = layerInfos;
        var radioOption;
        query('[name=\"UserName\"]').forEach(function(radio) {
          if(radio.checked) {
            radioOption = radio.value;
          }
        });
        if (radioOption === "default" && this.defaultUserName.value === ""){
          new Message({
            message: this.nls.noUserName
          });
          return false;
        }
        this.config.includeReportedBy = radioOption;
        this.config.defaultUserName = this.defaultUserName.value;
        return this.config;
      }
    });
  });