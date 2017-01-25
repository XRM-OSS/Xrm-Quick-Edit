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
(function (ViewHandler, undefined) {
    "use strict";
    
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
    
    function GetUpdates() {
        var records = XrmTranslator.GetGrid().records;
        
        var updates = [];
        
        for (var i = 0; i < records.length; i++) {
            var record = records[i];
            
            if (record.w2ui && record.w2ui.changes) {
                var attribute = XrmTranslator.GetAttributeById (record.recid);
                var labels = attribute.DisplayName.LocalizedLabels;
                
                var changes = record.w2ui.changes;
                
                ApplyChanges(changes, labels);
                updates.push(attribute);
            }
        }
        
        return updates;
    }
    
    function FillTable () {
        var grid = XrmTranslator.GetGrid();
        grid.clear();
        
        var records = [];
        
        if (XrmTranslator.metadata.length < 1) {
            return;
        }
        
        var views = XrmTranslator.metadata[0].views.value;
        
        for (var i = 0; i < views.length; i++) {
            var view = views[i];
            
            var record = {
               recid: view.savedqueryid,
               schemaName: "View"
            };

            // Iterate through all languages            
            for (var j = 0; j < XrmTranslator.metadata.length; j++) {
                var viewByLanguage = XrmTranslator.metadata[j];                
                record[viewByLanguage.languageCode] = viewByLanguage.views.value[i].name;
            }
            
            records.push(record);
        }
        
        grid.add(records);
        grid.unlock();
    }
    
    ViewHandler.Load = function() {
        var entityName = XrmTranslator.GetEntity();
        
        var entityMetadataId = XrmTranslator.entityMetadata[entityName];
        
        var queryRequest = {
            entityName: "savedquery", 
            queryParams: "?$filter=returnedtypecode eq '" + entityName.toLowerCase() + "' and iscustomizable/Value eq true&$orderby=savedqueryid asc"
        };
        
        var languages = XrmTranslator.installedLanguages.LocaleIds;
        var initialLanguage = XrmTranslator.userSettings.uilanguageid;
        var views = [];
        var requests = [];
        
        for (var i = 0; i < languages.length; i++) {
            requests.push({
                action: "Update",
                language: languages[i]
            });
            
            requests.push({
                action: "Retrieve",
                language: languages[i]
            });
        }
        
        requests.push({
            action: "Update",
            language: initialLanguage
        });

        Promise.reduce(requests, function(total, request){
            if (request.action === "Update") {
                return WebApiClient.Update({
                    overriddenSetName: "usersettingscollection",
                    entityId: XrmTranslator.userId,
                    entity: { uilanguageid: request.language }
                })
                .then(function(response) {
                    return total;
                });
            }
            else if (request.action === "Retrieve") {
                return Promise.props({
                    views: WebApiClient.Retrieve(queryRequest),
                    languageCode: request.language
                })
                .then(function (response) {
                    total.push(response);
                    
                    return total;
                }); 
            }
        }, [])
        .then(function(responses) {
                var views = responses;
                XrmTranslator.metadata = views;
                
                FillTable();
        })
        .catch(XrmTranslator.errorHandler);
    }
    
    ViewHandler.Save = function() {
        XrmTranslator.LockGrid("Saving");
        
        var updates = GetUpdates();
        
        var requests = [];
        var entityUrl = WebApiClient.GetApiUrl() + "EntityDefinitions(" + XrmTranslator.GetEntityId() + ")/Attributes(";
        
        for (var i = 0; i < updates.length; i++) {
            var update = updates[i];
            var url = entityUrl + update.MetadataId + ")";
            
            var request = {
                method: "PUT", 
                url: url, 
                attribute: update, 
                headers: [{key: "MSCRM.MergeLabels", value: "true"}]
            };
            requests.push(request);
        }
        
        Promise.resolve(requests)
            .each(function(request) {
                return WebApiClient.SendRequest(request.method, request.url, request.attribute, request.headers);
            })
            .then(function (response){
                XrmTranslator.LockGrid("Publishing");
                
                return XrmTranslator.Publish();
            })
            .then(function (response) {
                XrmTranslator.LockGrid("Reloading");
                
                return ViewHandler.Load();
            })
            .catch(XrmTranslator.errorHandler);
    }
} (window.ViewHandler = window.ViewHandler || {}));