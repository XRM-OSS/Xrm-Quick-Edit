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
    
    var entityMetadata = {};
    var attributeMetadata = [];
    var availableLanguages = [];
    
    var currentEntity = null;
    
    function SchemaNameComparer (e1, e2) {
        if (e1.SchemaName < e2.SchemaName) {
            return -1;
        }
        
        if (e1.SchemaName > e2.SchemaName) {
            return 1;
        }
        
        return 0;
    }
    
    function GetGrid () {
        return w2ui.grid;
    }
    
    function LockGrid (message) {
        GetGrid().lock(message, true);
    }
    
    function UnlockGrid () {
        GetGrid().unlock();
    }
    
    function FillTable () {
        w2ui.grid.clear();
        
        var records = [];
        
        for (var i = 0; i < attributeMetadata.length; i++) {
            var attribute = attributeMetadata[i];

            var displayNames = attribute.DisplayName.LocalizedLabels;
            
            if (!displayNames || displayNames.length === 0) {
                continue;
            }
            
            var record = {
               recid: attribute.MetadataId,
               schemaName: attribute.SchemaName
            };
            
            for (var j = 0; j < displayNames.length; j++) {
                var displayName = displayNames[j];
                
                record[displayName.LanguageCode.toString()] = displayName.Label;
            }
            
            records.push(record);
        }
        
        w2ui.grid.add(records);
        w2ui.grid.unlock();
    }
    
    function LoadEntityAttributes (entityName) {
        var entityMetadataId = entityMetadata[entityName];
        
        var request = {
            entityName: "EntityDefinition",
            entityId: entityMetadataId,
            queryParams: "/Attributes?$filter=IsCustomizable/Value eq true and IsLogical eq false"
        };
        
        WebApiClient.Retrieve(request)
            .then(function(response) {
                var attributes = response.value.sort(SchemaNameComparer);
                attributeMetadata = attributes;
                
                FillTable();
            })
            .catch(function(error) {
               alert(error); 
            });
    }
    
    function GetAttributeById (id) {
        for (var i = 0; i < attributeMetadata.length; i++) {
            var attribute = attributeMetadata[i];
            
            if (attribute.MetadataId === id) {
                return attribute;
            }
        }
        
        return null;
    }
    
    function ApplyChanges(changes, labels) {
        for (var change in changes) {
            if (!changes.hasOwnProperty(change)) {
                continue;
            }
            
            for (var i = 0; i < labels.length; i++) {
                var label = labels[i];
                
                if (label.LanguageCode == change) {
                    label.Label = changes[change];
                    label.HasChanged = true;
                    
                    break;
                }
                
                // Did not find label for this language
                if (i === labels.length - 1) {
                    labels.push({ LanguageCode: change, Label: changes[change] })
                }
            }
        }
    }
    
    function GetUpdates () {
        var records = w2ui.grid.records;
        
        var updates = [];
        
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (record.w2ui && record.w2ui.changes) {
                var attribute = GetAttributeById (record.recid);
                var labels = attribute.DisplayName.LocalizedLabels;
                
                var changes = record.w2ui.changes;
                
                ApplyChanges(changes, labels);
                updates.push(attribute);
            }
        }
        
        return updates;
    }
    
    function Publish() {
        var xml = "<importexportxml><entities><entity>" + currentEntity.toLowerCase() + "</entity></entities></importexportxml>";
        
        return WebApiClient.SendRequest("POST", WebApiClient.GetApiUrl() + "PublishXml", { ParameterXml: xml });
    }
    
    function Save() {
        LockGrid("Saving");
        
        var updates = GetUpdates();
        
        var requests = [];
        var entityUrl = WebApiClient.GetApiUrl() + "EntityDefinitions(" + entityMetadata[currentEntity] + ")/Attributes(";
        
        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];
            var url = entityUrl + update.MetadataId + ")";
            
            var request = WebApiClient.SendRequest("PUT", url, update, [{key: "MSCRM.MergeLabels", value: "true"}]);
            requests.push(request);
        }
        
        Promise.all(requests)
            .then(function (response){
                LockGrid("Publishing");
                
                return Publish();
            })
            .then(function (response) {
                LockGrid("Reloading");
                
                return LoadEntityAttributes(currentEntity);
            })
            .then(function (response) {
                UnlockGrid();
            })
            .catch(function (error) {
                alert(error);
            });
    }
          
    function InitializeGrid (entities) {        
        $('#grid').w2grid({ 
            name: 'grid', 
            show: { 
                toolbar: true,
                footer: true,
                toolbarSave: true
            },
            columns: [                
                { field: 'recid', caption: 'Metadata ID', size: '50px', sortable: true, resizable: true, hidden: true },
                { field: 'schemaName', caption: 'Schema Name', size: '200px', sortable: true, resizable: true }
            ],
            onSave: function (event) {
                Save();
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
                    }
                ],
                onClick: function(event) {
                    var target = event.target;
                    
                    if (target.indexOf(":") !== -1) {
                        var entity = target.substring(target.indexOf(":") + 1);
                        
                        currentEntity = entity;
                        
                        LockGrid("Loading " + entity + " attributes");
                        LoadEntityAttributes(entity);
                    }
                }
            }
        }); 
        
        LockGrid("Loading entities");
    }
    
    function FillEntitySelector (entities) {
        entities = entities.sort(SchemaNameComparer);
        var entitySelect = w2ui.grid_toolbar.get("entitySelect").items;
        
        for (var i = 0; i < entities.length; i++) {
            var entity = entities[i];
            
            entitySelect.push(entity.SchemaName);
            entityMetadata[entity.SchemaName] = entity.MetadataId;
        }
        
        return entities;
    }
    
    function FillLanguageCodes (languages) {
        availableLanguages = languages;
        
        for (var i = 0; i < languages.length; i++) {
            var language = languages[i];
            
            w2ui.grid.addColumn({ field: language, caption: language, size: '120px', editable: { type: 'text' } });
        }
        
        return languages;
    }
    
    function GetEntities() {
        var request = {
            entityName: "EntityDefinition",
            queryParams: "?$select=SchemaName,MetadataId&$filter=IsCustomizable/Value eq true"
        };

        return WebApiClient.Retrieve(request);
    }
    
    function GetAvailableLanguages () {
        var request = {
            // Yes, we're abusing it. Might add a function parameter to the request some time
            overriddenSetName: "RetrieveAvailableLanguages"
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
                return GetAvailableLanguages();
            })
            .then(function(languages) {
                return FillLanguageCodes(languages.LocaleIds);
            })
            .then(function (){
                w2ui.grid.unlock();
            })
            .catch(function(error) {
                alert(error.Message);
            });
    }
} (window.XrmTranslator = window.XrmTranslator || {}));