/* @preserve
 * MIT License
 *
 * Copyright (c) 2017 Florian Krönert
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
*/
(function (XrmTranslator, undefined) {
    "use strict";
    
    XrmTranslator.entityMetadata = {};
    XrmTranslator.metadata = [];
    
    XrmTranslator.entity = null;
    XrmTranslator.type = null;
    
    var currentHandler = null;
    
    XrmTranslator.GetEntity = function() {
        return w2ui.grid_toolbar.get("entitySelect").selected;
    }
    
    XrmTranslator.GetEntityId = function() {
        return XrmTranslator.entityMetadata[XrmTranslator.GetEntity()]
    }
    
    XrmTranslator.GetType = function() {
        return w2ui.grid_toolbar.get("type").selected;
    }
    
    function SetHandler() {
        if (XrmTranslator.GetType() === "attributes") {
            currentHandler = AttributeHandler;
        }
        else if (XrmTranslator.GetType() === "options") {
            currentHandler = OptionSetHandler;
        }
    }
    
    XrmTranslator.errorHandler = function(error) {
        if(error.statusText) {
            alert(error.statusText);
        }
        else {
            alert(error);
        }
        
        XrmTranslator.UnlockGrid();
    }
    
    XrmTranslator.SchemaNameComparer = function(e1, e2) {
        if (e1.SchemaName < e2.SchemaName) {
            return -1;
        }
        
        if (e1.SchemaName > e2.SchemaName) {
            return 1;
        }
        
        return 0;
    }
    
    XrmTranslator.GetGrid = function() {
        return w2ui.grid;
    }
    
    XrmTranslator.LockGrid = function (message) {
        XrmTranslator.GetGrid().lock(message, true);
    }
    
    XrmTranslator.UnlockGrid = function () {
        XrmTranslator.GetGrid().unlock();
    }
    
    XrmTranslator.Publish = function() {
        var xml = "<importexportxml><entities><entity>" + XrmTranslator.GetEntity().toLowerCase() + "</entity></entities></importexportxml>";
        
        return WebApiClient.SendRequest("POST", WebApiClient.GetApiUrl() + "PublishXml", { ParameterXml: xml });
    }
    
    XrmTranslator.GetRecord = function(records, selector) {
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (selector(record)) {
                return record;
            }
        }
        
        return null;
    }
          
    function InitializeGrid (entities) {        
        $('#grid').w2grid({ 
            name: 'grid', 
            show: { 
                toolbar: true,
                footer: true,
                toolbarSave: true,
                toolbarSearch: true
            },
            multiSearch: true,
            searches: [
                { field: 'schemaName', caption: 'Schema Name', type: 'text' }
            ],
            columns: [
                { field: 'schemaName', caption: 'Schema Name', size: '20%', sortable: true, resizable: true }
            ],
            onSave: function (event) {
                currentHandler.Save();
            },
            toolbar: {
                items: [
                    { type: 'menu-radio', id: 'entitySelect', icon: 'fa-star',
                        text: function (item) {
                            var text = item.selected;
                            var el = this.get('entitySelect:' + item.selected);
                            
                            if (el) {
                                return 'Entity: ' + el.text;
                            }
                            else {
                                return "Choose entity";
                            }
                        },
                        items: []
                    },
                    { type: 'menu-radio', id: 'type', icon: 'fa-star',
                        text: function (item) {
                            var text = item.selected;
                            var el   = this.get('type:' + item.selected);
                            return 'Type: ' + el.text;
                        },
                        selected: 'attributes',
                        items: [
                            { id: 'attributes', text: 'Attributes', icon: 'fa-camera' },
                            { id: 'options', text: 'Options', icon: 'fa-picture' }
                        ]
                    },
                    { type: 'button', id: 'load', text: 'Load' },
                    { type: 'button', id: 'autoTranslate', text: 'Auto Translate' }
                ],
                onClick: function(event) {
                    var target = event.target;
                    
                    if (target === "autoTranslate") {
                        TranslationHandler.ShowTranslationPrompt();
                    }
                    else if (target === "load") {
                        var entity = XrmTranslator.GetEntity();
                        
                        if (!entity || !XrmTranslator.GetType()) {
                            return;
                        }
                        
                        SetHandler();
                        
                        XrmTranslator.LockGrid("Loading " + entity + " attributes");
                        
                        currentHandler.Load();
                    }
                }
            }
        }); 
        
        XrmTranslator.LockGrid("Loading entities");
    }
    
    function FillEntitySelector (entities) {
        entities = entities.sort(XrmTranslator.SchemaNameComparer);
        var entitySelect = w2ui.grid_toolbar.get("entitySelect").items;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            
            entitySelect.push(entity.SchemaName);
            XrmTranslator.entityMetadata[entity.SchemaName] = entity.MetadataId;
        }
        
        return entities;
    }
    
    function GetEntities() {
        var request = {
            entityName: "EntityDefinition",
            queryParams: "?$select=SchemaName,MetadataId&$filter=IsCustomizable/Value eq true"
        };

        return WebApiClient.Retrieve(request);
    }
    
    XrmTranslator.Initialize = function() {
        InitializeGrid(); 
        
        GetEntities()
            .then(function(response){
                return FillEntitySelector(response.value);
            })
            .then(function (){
                return TranslationHandler.GetAvailableLanguages();
            })
            .then(function(languages) {
                return TranslationHandler.FillLanguageCodes(languages.LocaleIds);
            })
            .then(function (){
                XrmTranslator.UnlockGrid();
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.XrmTranslator = window.XrmTranslator || {}));